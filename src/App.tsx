// --- Punto de Restauración: Corrección Tabla Móvil Email ---

import React, { useState, useEffect, useRef } from "react"; // Import useRef

// Component for rendering a single input field with styling
const InputField = React.forwardRef(
  (
    {
      label,
      name,
      value,
      onChange,
      onBlur,
      placeholder = "",
      className = "",
      type = "text",
    },
    ref
  ) => {
    // Ensure value is explicitly a string, falling back to an empty string if null/undefined
    const safeValue =
      value === null || value === undefined ? "" : String(value);
    return (
      <div className="mb-2 w-full">
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
        <input
          type={type}
          id={name} // Keep ID for accessibility in header fields
          name={name}
          value={safeValue} // Use the safeValue
          onChange={onChange}
          onBlur={onBlur} // Add onBlur event for capitalization
          placeholder={placeholder}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 bg-gray-50 border ${className}`}
          ref={ref} // Pass the ref here
        />
      </div>
    );
  }
);

// Component for rendering a table cell input
const TableInput = React.forwardRef(
  (
    {
      name,
      value,
      onChange,
      onBlur,
      type = "text",
      placeholder = "",
      readOnly = false,
      isCanceledProp = false,
      list,
    },
    ref
  ) => {
    // Added 'list' prop
    // Ensure value is explicitly a string, falling back to an empty string if null/undefined
    const safeValue =
      value === null || value === undefined ? "" : String(value);
    return (
      <input
        type={type}
        // Removed dynamic 'id' prop from TableInput to prevent re-rendering/selection issues.
        name={name}
        value={safeValue} // Use the safeValue
        onChange={onChange}
        onBlur={onBlur} // Add onBlur event for capitalization
        placeholder={placeholder}
        // Apply line-through directly to the input if canceled
        className={`w-full h-full p-px border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-md ${
          isCanceledProp ? "line-through" : ""
        }`}
        ref={ref} // Pass the ref here
        readOnly={readOnly} // Apply readOnly property
        list={list} // Pass the list prop here
      />
    );
  }
);

// Main App component
const App = () => {
  // Function to get current ISO week number (moved outside to be available for initial state)
  const getCurrentWeekNumber = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year.
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    // January 4 is always in week 1.
    const week1 = new Date(date.getFullYear(), 0, 4);
    // Adjust to Sunday in week 1 and count number of weeks from date to week1.
    return (
      1 +
      Math.round(
        ((date.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7
      )
    );
  };

  // Function to generate the email subject based on template (moved outside)
  const generateEmailSubjectValue = (proveedores, especies) => {
    const weekNumber = getCurrentWeekNumber();

    const formatPart = (arr, defaultValue) => {
      const safeArr = Array.isArray(arr) ? arr : [];
      const uniqueValues = Array.from(new Set(safeArr))
        .filter((val) => typeof val === "string" && val.trim() !== "")
        .map((val) => val.toUpperCase().replace(/[^A-Z0-9]/g, "")); // Ensure uppercase for subject
      return uniqueValues.length > 0 ? uniqueValues.join("-") : defaultValue;
    };

    // Ensure only the first unique supplier name is used, or a default.
    const uniqueProveedores = Array.from(
      new Set(Array.isArray(proveedores) ? proveedores : [])
    ).filter((val) => typeof val === "string" && val.trim() !== "");
    const formattedProveedor =
      uniqueProveedores.length > 0
        ? uniqueProveedores[0].toUpperCase().replace(/[^A-Z0-9]/g, "")
        : "PROVEEDOR";

    const formattedEspecie = formatPart(especies, "ESPECIE");

    return `PED–W${weekNumber}–${formattedProveedor}–${formattedEspecie}`;
  };

  // Define initial blank states for header and items
  const initialHeaderState = {
    reDestinatarios: "",
    deNombrePais: "",
    nave: "",
    fechaCarga: "",
    exporta: "",
    // emailSubject will be initialized by the useState function below
  };
  const initialItemState = {
    id: crypto.randomUUID(),
    pallets: "",
    especie: "",
    variedad: "",
    formato: "",
    calibre: "",
    categoria: "",
    preciosFOB: "",
    estado: "",
    isCanceled: false,
  };

  // State for current order header information
  const [headerInfo, setHeaderInfo] = useState(() => ({
    ...initialHeaderState,
    emailSubject: generateEmailSubjectValue([], []), // Initialize with default subject
  }));

  // State for current order items (table rows)
  const [orderItems, setOrderItems] = useState([initialItemState]);

  // State to store all accumulated orders. Initialize with one blank order.
  const [accumulatedOrders, setAccumulatedOrders] = useState(() => [
    {
      header: {
        ...initialHeaderState,
        emailSubject: generateEmailSubjectValue([], []),
      }, // Initialize with default subject
      items: [{ ...initialItemState }],
    },
  ]);

  // State to track the index of the currently edited order within accumulatedOrders
  // Start at 0, indicating the first (and only) order in the accumulatedOrders array.
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);

  // State to control the visibility of the primary action modal (for preview and email options)
  const [showOrderActionsModal, setShowOrderActionsModal] = useState(false);
  // State to store the HTML content for the preview within the modal
  const [previewHtmlContent, setPreviewHtmlContent] = useState("");
  // State to control whether the preview content is currently shown in the modal
  const [isShowingPreview, setIsShowingPreview] = useState(false);
  // State to indicate if the email action has been triggered within the order actions modal
  const [emailActionTriggered, setEmailActionTriggered] = useState(false);

  // New states for observation modal
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [currentEditingItemData, setCurrentEditingItemData] = useState(null); // Stores the full item object
  const [modalObservationText, setModalObservationText] = useState("");
  // Ref for the observation modal textarea
  const observationTextareaRef = useRef(null);

  // Refs for managing focusable elements
  const headerInputRefs = useRef({});
  const tableInputRefs = useRef({}); // { rowId: { fieldName: HTMLInputElement } }

  // Define the order of header inputs for navigation
  const headerInputOrder = [
    "reDestinatarios",
    "deNombrePais",
    "nave",
    "fechaCarga",
    "exporta",
    "emailSubject",
  ];
  // Define the order of table columns for navigation (Removed 'estado' as it's now via modal)
  const tableColumnOrder = [
    "pallets",
    "especie",
    "variedad",
    "formato",
    "calibre",
    "categoria",
    "preciosFOB",
  ];

  // Effect to synchronize the email subject based on relevant header fields and first item details of the CURRENT order
  useEffect(() => {
    const currentProveedor = headerInfo.reDestinatarios;
    const currentEspecie = orderItems[0]?.especie || "";

    // Pass only the current supplier for the individual order's subject field
    const newSubjectForCurrentOrder = generateEmailSubjectValue(
      [currentProveedor],
      [currentEspecie]
    );

    // Only update if the new subject is different to avoid unnecessary re-renders
    if (newSubjectForCurrentOrder !== headerInfo.emailSubject) {
      setHeaderInfo((prevInfo) => ({
        ...prevInfo,
        emailSubject: newSubjectForCurrentOrder,
      }));
    }
  }, [
    headerInfo.reDestinatarios,
    orderItems[0]?.especie,
    headerInfo.emailSubject, // Keep this dependency to trigger update if manual edit happens
  ]);

  // Effect to load the initial order data when the component mounts or currentOrderIndex changes to 0
  useEffect(() => {
    if (
      accumulatedOrders.length > 0 &&
      currentOrderIndex === 0 &&
      headerInfo.reDestinatarios === "" &&
      orderItems.length === 1 &&
      orderItems[0].pallets === ""
    ) {
      // This effect ensures the initial state (Pedido 1) is loaded into the form
      // when the component first mounts or is reset, but only if the form is truly blank.
      setHeaderInfo(accumulatedOrders[0].header);
      setOrderItems(accumulatedOrders[0].items);
    }
  }, [accumulatedOrders, currentOrderIndex]);

  // Handler for saving current form data to accumulated orders
  const saveCurrentFormDataToAccumulated = () => {
    if (currentOrderIndex !== null && accumulatedOrders[currentOrderIndex]) {
      setAccumulatedOrders((prevOrders) => {
        const updatedOrders = [...prevOrders];
        updatedOrders[currentOrderIndex] = {
          header: { ...headerInfo },
          items: orderItems.map((item) => ({ ...item })),
        };
        return updatedOrders;
      });
    }
  };

  // Handle changes in header input fields
  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeaderInfo((prevInfo) => ({ ...prevInfo, [name]: value })); // Update immediately with raw value
  };

  // Handle blur for header input fields (apply uppercase here)
  const handleHeaderBlur = (e) => {
    const { name, value, type } = e.target;
    if (type !== "date" && type !== "number" && name !== "emailSubject") {
      setHeaderInfo((prevInfo) => ({
        ...prevInfo,
        [name]: value.toUpperCase(),
      }));
    }
  };

  // Handle changes in order item table input fields (only for fields still in table)
  const handleItemChange = (itemId, e) => {
    const { name, value } = e.target;
    setOrderItems((prevItems) => {
      return prevItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [name]: value, // Update immediately with raw value
            }
          : item
      );
    });
  };

  // Handle blur for table input fields (apply uppercase here)
  const handleItemBlur = (itemId, e) => {
    const { name, value, type } = e.target;

    setOrderItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === itemId) {
          let newValue = value;
          if (name === "preciosFOB") {
            // Extract all numeric-like parts from the input string
            const matches = value.match(/\d+([.,]\d+)?/g);
            const formattedPrices = [];

            if (matches && matches.length > 0) {
              for (const match of matches) {
                // Replace comma with dot for parsing, then format to 2 decimal places, then replace dot with comma for display
                const numericValue = parseFloat(match.replace(",", "."));
                if (!isNaN(numericValue)) {
                  formattedPrices.push(
                    `$ ${numericValue.toFixed(2).replace(".", ",")}`
                  ); // <-- Changed here
                }
              }
            }

            if (formattedPrices.length > 0) {
              newValue = formattedPrices.join(" - "); // Join with ' - ' for consistency
            } else {
              newValue = ""; // Clear if no valid numbers extracted
            }
          } else if (name === "calibre") {
            // Split by common delimiters (;, , -, space) and filter out empty strings
            const parts = value
              .split(/[,;\s-]+/)
              .filter((part) => part.trim() !== "")
              .map((part) => part.trim().toUpperCase()); // Trim and uppercase each part
            newValue = parts.join(" - "); // Join with ' - '
          } else if (name === "categoria") {
            // Extract alphanumeric parts (e.g., "PRE:XFY" -> "PRE", "XFY")
            // Or "PRE XFY"
            const matches = value.match(/[a-zA-Z0-9]+/g); // Matches alphanumeric sequences
            if (matches && matches.length > 0) {
              newValue = matches.join(" - ");
            } else {
              newValue = "";
            }
            newValue = newValue.toUpperCase(); // Apply uppercase here
          }
          // 'estado' is now handled by modal, so no direct blur logic for it here
          else if (type !== "number") {
            // Apply uppercase to all other text fields except numbers
            newValue = value.toUpperCase();
          }
          return { ...item, [name]: newValue };
        }
        return item;
      })
    );
  };

  // Add a new row to the order items table (duplication logic)
  const handleAddItem = (sourceItemId = null) => {
    setOrderItems((prevItems) => {
      if (sourceItemId) {
        const sourceItem = prevItems.find((item) => item.id === sourceItemId);
        if (sourceItem) {
          const newItem = {
            ...sourceItem,
            id: crypto.randomUUID(),
            isCanceled: false, // New duplicated item should not be canceled
          };
          // Insert the new item right after the source item
          const index = prevItems.findIndex((item) => item.id === sourceItemId);
          return [
            ...prevItems.slice(0, index + 1),
            newItem,
            ...prevItems.slice(index + 1),
          ];
        }
      }
      // Default: add an empty row
      return [
        ...prevItems,
        {
          id: crypto.randomUUID(),
          pallets: "",
          especie: "",
          variedad: "",
          formato: "",
          calibre: "",
          categoria: "",
          preciosFOB: "",
          estado: "",
          isCanceled: false,
        },
      ];
    });
  };

  // Delete a specific row from the order items table
  const handleDeleteItem = (idToDelete) => {
    setOrderItems((prevItems) => {
      if (prevItems.length <= 1) {
        console.log("No se puede eliminar la última fila.");
        return prevItems; // Do not delete if only one item remains
      }
      return prevItems.filter((item) => item.id !== idToDelete);
    });
  };

  // Toggle cancellation status of an item
  const toggleItemCancellation = (itemId) => {
    setOrderItems((prevItems) => {
      return prevItems.map((item) => {
        if (item.id === itemId) {
          const newIsCanceled = !item.isCanceled;
          return {
            ...item,
            isCanceled: newIsCanceled,
            // Set to CANCELADO if canceled, or clear if uncanceled (resetting observation)
            estado: newIsCanceled ? "CANCELADO" : "",
          };
        }
        return item;
      });
    });
  };

  // Calculate the total number of pallets for the CURRENT order, excluding canceled items
  const currentOrderTotalPallets = orderItems.reduce((sum, item) => {
    if (item.isCanceled) {
      // If the item is canceled, do not include its pallets in the total
      return sum;
    }
    const pallets = parseFloat(item.pallets) || 0;
    return sum + pallets;
  }, 0);

  // Helper function to format date
  const formatDateToSpanish = (dateString) => {
    const months = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const daysOfWeek = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
    try {
      const date = new Date(dateString + "T00:00:00");
      if (isNaN(date.getTime())) {
        console.warn(
          "Invalid date string received by formatDateToSpanish:",
          dateString
        );
        return dateString;
      }
      const dayOfWeek = daysOfWeek[date.getDay()];
      const dayOfMonth = date.getDate();
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${dayOfWeek} ${dayOfMonth} de ${month} de ${year}`;
    } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return dateString;
    }
  };

  // Function to generate the HTML for a single order block (for email)
  const generateSingleOrderHtml = (orderHeader, orderItemsData) => {
    // Filter out canceled items for the sum shown in the email HTML
    const nonCancelledItems = orderItemsData.filter((item) => !item.isCanceled);
    const singleOrderTotalPallets = nonCancelledItems.reduce((sum, item) => {
      const pallets = parseFloat(item.pallets) || 0;
      return sum + pallets;
    }, 0);

    // Consolidate observations for the order footer
    // Ensure all observations are included, even if empty, to ensure the field is always present
    const allObservations = orderItemsData
      .map((item) => item.estado)
      .filter(
        (obs) => obs && obs.trim() !== "" && obs.toUpperCase() !== "CANCELADO"
      ); // 'CANCELADO' is handled by line-through

    const consolidatedObservationsText =
      allObservations.length > 0 ? allObservations.join("; ") : "";

    // Use values directly as they are already uppercased on blur for most fields
    const formattedNave = orderHeader.nave;
    const formattedPais = orderHeader.deNombrePais;
    const formattedFechaCarga = orderHeader.fechaCarga
      ? formatDateToSpanish(orderHeader.fechaCarga)
      : "";
    const formattedExporta = orderHeader.exporta;

    // Adjusted column widths for better fit
    // Sum of widths: 8 + 10 + 15 + 10 + 12 + 15 + 30 = 100%
    const tableView = `
        <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-sizing: border-box; text-align: left; table-layout: fixed;">
            <thead>
                <tr style="background-color: #2563eb; color: #ffffff;">
                    <th style="padding: 3px 5px; border: 1px solid #1e40af; border-top-left-radius: 8px; text-align: center; font-size: 11px; box-sizing: border-box; width: 8%;">Pallets</th>
                    <th style="padding: 3px 5px; border: 1px solid #1e40af; text-align: center; font-size: 11px; box-sizing: border-box; width: 10%;">Especie</th>
                    <th style="padding: 3px 5px; border: 1px solid #1e40af; text-align: center; font-size: 11px; box-sizing: border-box; width: 15%;">Variedad</th>
                    <th style="padding: 3px 5px; border: 1px solid #1e40af; text-align: center; font-size: 11px; box-sizing: border-box; width: 10%;">Formato</th>
                    <th style="padding: 3px 5px; border: 1px solid #1e40af; text-align: center; font-size: 11px; box-sizing: border-box; width: 12%;">Calibre</th>
                    <th style="padding: 3px 5px; border: 1px solid #1e40af; text-align: center; font-size: 11px; box-sizing: border-box; width: 15%;">Categoría</th>
                    <th style="padding: 3px 5px; border: 1px solid #1e40af; border-top-right-radius: 8px; text-align: center; font-size: 11px; box-sizing: border-box; width: 30%;">Precios FOB</th>
                </tr>
            </thead>
            <tbody>
                ${orderItemsData
                  .map((item, idx) => {
                    const style = item.isCanceled
                      ? "color: #ef4444; text-decoration: line-through;"
                      : "";
                    return (
                      `<tr style="${
                        idx % 2 === 0
                          ? "background-color: #f9f9f9;"
                          : "background-color: #ffffff;"
                      }${style}">` +
                      `<td style="padding: 3px 5px; border: 1px solid #eee; text-align: center; box-sizing: border-box; font-size: 11px;">${item.pallets}</td>` +
                      `<td style="padding: 3px 5px; border: 1px solid #eee; text-align: center; box-sizing: border-box; font-size: 11px;">${item.especie}</td>` +
                      `<td style="padding: 3px 5px; border: 1px solid #eee; text-align: center; font-size: 11px;">${item.variedad}</td>` +
                      `<td style="padding: 3px 5px; border: 1px solid #eee; text-align: center; font-size: 11px;">${item.formato}</td>` +
                      `<td style="padding: 3px 5px; border: 1px solid #eee; text-align: center; font-size: 11px;">${item.calibre}</td>` +
                      `<td style="padding: 3px 5px; border: 1px solid #eee; text-align: center; font-size: 11px;">${item.categoria}</td>` +
                      `<td style="padding: 3px 5px; border: 1px solid #eee; text-align: center; box-sizing: border-box; font-size: 11px;">${item.preciosFOB}</td>` +
                      `</tr>`
                    );
                  })
                  .join("")}
                <tr style="background-color: #e0e0e0;">
                    <td colSpan="6" style="padding: 6px 15px 6px 6px; text-align: right; font-weight: bold; border: 1px solid #ccc; border-bottom-left-radius: 8px; margin-top: 15px; box-sizing: border-box; font-size: 11px;">Total de Pallets:</td>
                    <td colSpan="1" style="padding: 6px; font-weight: bold; border: 1px solid #ccc; border-bottom-right-radius: 8px; text-align: center; box-sizing: border-box; font-size: 11px;">
                        ${singleOrderTotalPallets} Pallets
                    </td>
                </tr>
            </tbody>
        </table>
    `;

    // The single order container in the email.
    return `
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 8px; width: 100%; max-width: 900px; text-align: left; box-sizing: border-box;">
            <style>
                /* Estilos responsivos para email */
                @media only screen and (max-width: 767px) { /* Changed to 767px for mobile breakpoint */
                    .email-header-p {
                        font-size: 12px !important; /* Más pequeño para móviles */
                        margin-bottom: 1px !important; /* Reducir aún más el espacio */
                    }
                    .email-header-p:last-of-type {
                        margin-bottom: 4px !important; /* Un poco más de espacio antes de la tabla */
                    }
                    h3 {
                        font-size: 16px !important; /* Ajustar tamaño de título de pedido para móvil */
                        margin-top: 20px !important;
                        margin-bottom: 10px !important;
                    }
                    /* New styles for table cells on mobile */
                    table th, table td {
                        font-size: 9px !important; /* Reduced font size for mobile */
                        padding: 2px 3px !important; /* Reduced padding for mobile */
                    }
                }
                /* Ensure tables don't overflow on small screens */
                table {
                    max-width: 100% !important;
                    width: 100% !important;
                    display: block !important; /* Forces table to behave like a block element, necessary for overflow-x */
                    table-layout: fixed; /* Ensures columns respect defined widths */
                }
                /* Removed white-space: nowrap; from th and td directly */
            </style>
            <p class="email-header-p" style="margin: 0; margin-bottom: 2px;"><strong>País:</strong> <u>${formattedPais}</u></p>
            <p class="email-header-p" style="margin: 0; margin-bottom: 2px;"><strong>Nave:</strong> ${formattedNave}</p>
            <p class="email-header-p" style="margin: 0; margin-bottom: 2px;"><strong>Fecha de carga:</strong> ${formattedFechaCarga}</p>
            <p class="email-header-p" style="margin: 0; margin-bottom: 8px;"><strong>Exporta:</strong> ${formattedExporta}</p>

            ${tableView}
            <p style="margin-top: 10px; font-weight: bold; font-size: 13px;">Observaciones: <span style="font-weight: normal; font-style: italic;">${consolidatedObservationsText}</span></p>
        </div>
    `;
  };

  // Function to copy the formatted HTML content to clipboard
  const copyFormattedContentToClipboard = (content) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    document.body.appendChild(tempDiv);

    const range = document.createRange();
    range.selectNodeContents(tempDiv);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    document.execCommand("copy");
    document.body.removeChild(tempDiv);
  };

  // Helper function to get all orders for email/preview, ensuring current form state is included
  const getAllOrdersForProcessingForSendPreview = () => {
    // Save current form data before gathering all orders
    saveCurrentFormDataToAccumulated();
    return [...accumulatedOrders];
  };

  // Handler for "Agregar Pedido" button
  const handleAddOrder = () => {
    // 1. Save the current order's data into the accumulatedOrders list
    saveCurrentFormDataToAccumulated();

    // 2. Prepare a new blank header and items for the next order
    const newBlankHeader = {
      reDestinatarios: headerInfo.reDestinatarios, // Carry over supplier name
      deNombrePais: "",
      nave: "",
      fechaCarga: "",
      exporta: "",
      // Ensure emailSubject is generated based on the carried-over supplier for the *new* order
      emailSubject: generateEmailSubjectValue([headerInfo.reDestinatarios], []),
    };
    const newBlankItems = [
      {
        id: crypto.randomUUID(),
        pallets: "",
        especie: "",
        variedad: "",
        formato: "",
        calibre: "",
        categoria: "",
        preciosFOB: "",
        estado: "",
        isCanceled: false,
      },
    ];

    // 3. Add the new blank order to accumulatedOrders
    setAccumulatedOrders((prevOrders) => {
      return [...prevOrders, { header: newBlankHeader, items: newBlankItems }];
    });

    // 4. Set the current form to display this new blank order
    setHeaderInfo(newBlankHeader);
    setOrderItems(newBlankItems);
    // Set currentOrderIndex to the new last index (which is prevOrders.length)
    setCurrentOrderIndex(accumulatedOrders.length);
  };

  // Handler for "Anterior" button
  const handlePreviousOrder = () => {
    if (currentOrderIndex === 0) {
      console.log("Ya estás en el primer pedido.");
      return;
    }

    // Save current form data before navigating
    saveCurrentFormDataToAccumulated();

    // Load the previous order
    const newIndex = currentOrderIndex - 1;
    setHeaderInfo(accumulatedOrders[newIndex].header);
    setOrderItems(accumulatedOrders[newIndex].items);
    setCurrentOrderIndex(newIndex);
  };

  // Handler for "Siguiente" button
  const handleNextOrder = () => {
    if (currentOrderIndex === accumulatedOrders.length - 1) {
      console.log("Ya estás en el último pedido.");
      return;
    }

    // Save current form data before navigating
    saveCurrentFormDataToAccumulated();

    // Load the next order
    const newIndex = currentOrderIndex + 1;
    setHeaderInfo(accumulatedOrders[newIndex].header);
    setOrderItems(accumulatedOrders[newIndex].items);
    setCurrentOrderIndex(newIndex);
  };

  // Function to detect if the device is mobile (more robust for preview environment)
  const isMobileDevice = () => {
    // Use window.innerWidth for more direct control in preview, as matchMedia might be influenced by iframe
    return window.innerWidth <= 767; // Assuming 767px is the breakpoint for mobile (Tailwind's 'md' is 768px)
  };

  // Function to perform the actual email sending (copy and open client)
  const performSendEmail = () => {
    // 1. Ensure current form data is saved before gathering all orders for email
    saveCurrentFormDataToAccumulated();

    const finalOrdersForEmail = [...accumulatedOrders]; // All accumulated orders are now up-to-date

    // 2. Set modal flags to show email action in progress
    setEmailActionTriggered(true);
    setIsShowingPreview(false); // Hide preview as email action is primary
    setPreviewHtmlContent(""); // Clear preview content

    // If there are no orders to send, show a message and close the modal.
    if (finalOrdersForEmail.length === 0) {
      console.log("No hay pedidos para enviar.");
      setShowOrderActionsModal(false); // Close modal if no orders to send.
      return;
    }

    let innerEmailContentHtml = "";
    const allProveedores = new Set();
    const allEspecies = new Set();

    finalOrdersForEmail.forEach((order, index) => {
      innerEmailContentHtml += `
          <h3 style="font-size: 18px; color: #2563eb; margin-top: 40px; margin-bottom: 15px; text-align: left;">Pedido #${
            index + 1
          }</h3>
          ${generateSingleOrderHtml(order.header, order.items)}
      `;

      if (order.header.reDestinatarios)
        allProveedores.add(order.header.reDestinatarios);
      order.items.forEach((item) => {
        if (item.especie) allEspecies.add(item.especie);
      });
    });

    // Wrap the entire email body content in a div.
    const fullEmailBodyHtml = `
      <div style="font-family: Arial, sans-serif; padding: 0px; box-sizing: border-box; background-color: #f8f8f8; border-radius: 8px; text-align: left;">
        ${innerEmailContentHtml}
      </div>
    `;

    copyFormattedContentToClipboard(fullEmailBodyHtml);

    const consolidatedSubject = generateEmailSubjectValue(
      Array.from(allProveedores),
      Array.from(allEspecies)
    );

    const recipient = "";
    const emailBodyTextForMailto =
      "El contenido del pedido ha sido copiado a tu portapapeles. Por favor, abre tu aplicación de correo y pega el contenido manualmente en el cuerpo del mensaje.";

    // Intenta abrir el cliente de correo
    if (isMobileDevice()) {
      // Use isMobileDevice() again to ensure mobile client is targeted
      const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(
        consolidatedSubject
      )}&body=${encodeURIComponent(emailBodyTextForMailto)}`;
      window.location.href = mailtoLink;
    } else {
      window.open(
        `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${recipient}&su=${encodeURIComponent(
          consolidatedSubject
        )}&body=`,
        "_blank"
      );
    }

    // 3. Reset the application state after email action is complete
    const blankHeaderAfterSend = {
      reDestinatarios: "",
      deNombrePais: "",
      nave: "",
      fechaCarga: "",
      exporta: "",
      emailSubject: generateEmailSubjectValue([], []),
    };
    const blankItemsAfterSend = [
      {
        id: crypto.randomUUID(),
        pallets: "",
        especie: "",
        variedad: "",
        formato: "",
        calibre: "",
        categoria: "",
        preciosFOB: "",
        estado: "",
        isCanceled: false,
      },
    ];

    // Reset to a single blank order (the new "Pedido 1")
    setAccumulatedOrders([
      {
        header: { ...blankHeaderAfterSend },
        items: [{ ...blankItemsAfterSend[0] }],
      },
    ]);
    setHeaderInfo(blankHeaderAfterSend);
    setOrderItems(blankItemsAfterSend);
    setCurrentOrderIndex(0); // Go back to index 0 (the new "Pedido 1")

    // 4. Finally, close the modal. This happens immediately after all actions.
    setShowOrderActionsModal(false);
    setEmailActionTriggered(false); // Reset this flag for the next time
    setIsShowingPreview(false); // Reset preview state
    setPreviewHtmlContent(""); // Clear preview content
  };

  // Handler for "Finalizar Pedido" button (new main button)
  const handleFinalizeOrder = () => {
    // Save current form data before opening the modal for final actions
    saveCurrentFormDataToAccumulated();
    setShowOrderActionsModal(true);
    setEmailActionTriggered(false); // Reset email action triggered state
    setIsShowingPreview(false); // Ensure preview is hidden when modal first opens
    setPreviewHtmlContent(""); // Clear any previous preview content
  };

  // Function to handle the "Previsualizar Pedido" action (called from within modal)
  const handlePreviewOrder = () => {
    const ordersToPreview = getAllOrdersForProcessingForSendPreview();

    if (ordersToPreview.length === 0) {
      setPreviewHtmlContent(
        '<p style="text-align: center; color: #888;">No hay pedidos para previsualizar.</p>'
      );
    } else {
      let innerPreviewHtml = "";
      ordersToPreview.forEach((order, index) => {
        innerPreviewHtml += `
          <h3 style="font-size: 18px; color: #2563eb; margin-top: 20px; margin-bottom: 10px; text-align: left;">Pedido #${
            index + 1
          }</h3>
          ${generateSingleOrderHtml(order.header, order.items)}
        `;
      });

      // Wrap the entire preview content in a div.
      const finalPreviewHtml = `
        <div style="font-family: Arial, sans-serif; padding: 0px; box-sizing: border-box; text-align: left;">
          ${innerPreviewHtml}
        </div>
      `;
      setPreviewHtmlContent(finalPreviewHtml);
    }
    setIsShowingPreview(true); // Show the preview content within the current modal
    // No change to emailActionTriggered here, as preview doesn't imply email send
  };

  // Function to open the observation modal
  const handleOpenObservationModal = (itemId) => {
    const itemToEdit = orderItems.find((item) => item.id === itemId);
    if (itemToEdit) {
      setCurrentEditingItemData(itemToEdit);
      setModalObservationText(itemToEdit.estado); // Initialize modal's input with current observation
      setShowObservationModal(true);
    }
  };

  // Effect to focus and select text in the observation modal when it opens
  useEffect(() => {
    if (showObservationModal && observationTextareaRef.current) {
      observationTextareaRef.current.focus();
      // Select the content, but only if there is content to select
      if (observationTextareaRef.current.value) {
        observationTextareaRef.current.select();
      }
    }
  }, [showObservationModal]);

  // Function to save the observation from modal
  const handleSaveObservation = () => {
    if (currentEditingItemData) {
      // Capitalize only the first letter, and make the rest lowercase for consistency
      const formattedObservation = modalObservationText
        ? modalObservationText.charAt(0).toUpperCase() +
          modalObservationText.slice(1).toLowerCase()
        : "";
      setOrderItems((prevItems) =>
        prevItems.map((item) =>
          item.id === currentEditingItemData.id
            ? { ...item, estado: formattedObservation }
            : item
        )
      );
    }
    setShowObservationModal(false);
    setCurrentEditingItemData(null);
    setModalObservationText("");
  };

  // Function to close the observation modal (cancel)
  const handleCloseObservationModal = () => {
    setShowObservationModal(false);
    setCurrentEditingItemData(null);
    setModalObservationText("");
  };

  // Effect for keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      let isHandled = false;

      const isOurInput = (element) => {
        return (
          element.tagName === "INPUT" &&
          element.name &&
          (headerInputOrder.includes(element.name) ||
            tableColumnOrder.includes(element.name))
        );
      };

      if (!isOurInput(activeElement)) {
        return;
      }

      const headerIndex = headerInputOrder.indexOf(activeElement.name);
      let tablePosition = null;
      if (headerIndex === -1) {
        for (const rowId in tableInputRefs.current) {
          for (const colName in tableInputRefs.current[rowId]) {
            if (tableInputRefs.current[rowId][colName] === activeElement) {
              tablePosition = { rowId, colName };
              break;
            }
          }
          if (tablePosition) break;
        }
      }

      if (
        e.key === "ArrowRight" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown"
      ) {
        e.preventDefault();

        if (headerIndex !== -1) {
          let nextIndex = headerIndex;
          if (e.key === "ArrowRight") {
            nextIndex = (headerIndex + 1) % headerInputOrder.length;
          } else if (e.key === "ArrowLeft") {
            nextIndex =
              (headerIndex - 1 + headerInputOrder.length) %
              headerInputOrder.length;
          } else if (e.key === "ArrowDown") {
            if (orderItems.length > 0) {
              const firstRowId = orderItems[0].id;
              const firstColName = tableColumnOrder[0];
              if (
                tableInputRefs.current[firstRowId] &&
                tableInputRefs.current[firstRowId][firstColName]
              ) {
                tableInputRefs.current[firstRowId][firstColName].focus();
                isHandled = true;
              }
            }
          } else if (e.key === "ArrowUp") {
            nextIndex =
              (headerIndex - 1 + headerInputOrder.length) %
              headerInputOrder.length;
            if (headerInputRefs.current[headerInputOrder[nextIndex]]) {
              headerInputRefs.current[headerInputOrder[nextIndex]].focus();
              isHandled = true;
            }
          }
          if (
            !isHandled &&
            headerInputRefs.current[headerInputOrder[nextIndex]]
          ) {
            headerInputRefs.current[headerInputOrder[nextIndex]].focus();
            isHandled = true;
          }
        } else if (tablePosition) {
          const { rowId, colName } = tablePosition;
          const currentRowIndex = orderItems.findIndex(
            (item) => item.id === rowId
          );
          const currentColIndex = tableColumnOrder.indexOf(colName);

          let targetRowIndex = currentRowIndex;
          let targetColIndex = currentColIndex;

          if (e.key === "ArrowRight") {
            targetColIndex++;
            if (targetColIndex >= tableColumnOrder.length) {
              targetColIndex = 0;
              targetRowIndex++;
            }
          } else if (e.key === "ArrowLeft") {
            targetColIndex--;
            if (targetColIndex < 0) {
              targetColIndex = tableColumnOrder.length - 1;
              targetRowIndex--;
            }
          }
          // The ArrowUp/ArrowDown logic for table navigation is already present and correct
          else if (e.key === "ArrowDown") {
            targetRowIndex++;
          } else if (e.key === "ArrowUp") {
            targetRowIndex--;
          }

          let nextElementToFocus = null;

          if (targetRowIndex >= 0 && targetRowIndex < orderItems.length) {
            const targetRowId = orderItems[targetRowIndex]?.id;
            const targetColName = tableColumnOrder[targetColIndex];
            if (
              tableInputRefs.current[targetRowId] &&
              tableInputRefs.current[targetRowId][targetColName]
            ) {
              nextElementToFocus =
                tableInputRefs.current[targetRowId][targetColName];
            }
          } else if (targetRowIndex < 0) {
            const lastHeaderInputName =
              headerInputOrder[headerInputOrder.length - 1];
            nextElementToFocus = headerInputRefs.current[lastHeaderInputName];
          } else if (targetRowIndex >= orderItems.length) {
            const lastValidRowIndex = orderItems.length - 1;
            const lastValidRowId = orderItems[lastValidRowIndex]?.id;
            const targetColName = tableColumnOrder[currentColIndex];
            if (
              lastValidRowId &&
              tableInputRefs.current[lastValidRowId] &&
              tableInputRefs.current[lastValidRowId][targetColName]
            ) {
              nextElementToFocus =
                tableInputRefs.current[lastValidRowId][targetColName];
            }
          }

          if (nextElementToFocus) {
            nextElementToFocus.focus();
            isHandled = true;
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [orderItems, headerInfo]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-inter">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-4 sm:p-6 space-y-6 relative">
        <img
          src="https://www.vpcom.com/images/logo-vpc.png"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src =
              "https://placehold.co/100x40/FFFFFF/000000?text=LogoVPC";
          }}
          alt="Logo VPC"
          className="absolute top-4 right-4 w-20 sm:w-24 md:w-32 h-auto object-contain rounded-md z-10"
        />

        <div className="border-b pb-4 mb-4 pt-16 sm:pt-0">
          <h1 className="text-xl sm:text-2xl font-bold text-center text-gray-800 mb-4">
            Pedidos Comercial Frutam
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div>
              <InputField
                label="Nombre de Proveedor:"
                name="reDestinatarios"
                value={headerInfo.reDestinatarios}
                onChange={handleHeaderChange}
                onBlur={handleHeaderBlur}
                placeholder="Ingrese nombre de proveedor"
                ref={(el) => (headerInputRefs.current.reDestinatarios = el)}
              />
            </div>
            <div>
              <InputField
                label="País:"
                name="deNombrePais"
                value={headerInfo.deNombrePais}
                onChange={handleHeaderChange}
                onBlur={handleHeaderBlur}
                placeholder="País de destino"
                ref={(el) => (headerInputRefs.current.deNombrePais = el)}
              />
            </div>
            <div>
              <InputField
                label="Nave:"
                name="nave"
                value={headerInfo.nave}
                onChange={handleHeaderChange}
                onBlur={handleHeaderBlur}
                placeholder="Nombre de Nave"
                ref={(el) => (headerInputRefs.current.nave = el)}
              />
            </div>
            <div>
              <InputField
                label="Fecha de carga:"
                name="fechaCarga"
                value={headerInfo.fechaCarga}
                onChange={handleHeaderChange}
                onBlur={handleHeaderBlur}
                placeholder="FECHA DE CARGA"
                type="date"
                ref={(el) => (headerInputRefs.current.fechaCarga = el)}
              />
            </div>
            <div>
              <InputField
                label="Exporta:"
                name="exporta"
                value={headerInfo.exporta}
                onChange={handleHeaderChange}
                onBlur={handleHeaderBlur}
                placeholder="Exportadora"
                ref={(el) => (headerInputRefs.current.exporta = el)}
              />
            </div>
            <div>
              <InputField
                label="Asunto del Email:"
                name="emailSubject"
                value={headerInfo.emailSubject}
                onChange={handleHeaderChange}
                onBlur={handleHeaderBlur}
                placeholder="Asunto del Correo (Se auto-completa)"
                ref={(el) => (headerInputRefs.current.emailSubject = el)}
              />
            </div>
          </div>
        </div>

        {/* Navigation Buttons and Order Indicator - ABOVE the table */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-4 mb-6">
          <div className="flex items-center justify-center w-full sm:w-auto">
            {/* Previous Button - icon then text */}
            <button
              onClick={handlePreviousOrder}
              disabled={currentOrderIndex === 0}
              className="flex items-center justify-center px-3 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              title="Ir al pedido anterior"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.707 4.293a1 1 0 010 1.414L5.414 10l4.293 4.293a1 1 0 01-1.414 1.414l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="hidden sm:inline ml-1">Anterior</span>
            </button>

            {/* Order Indicator */}
            <span className="text-center text-gray-700 font-semibold text-lg mx-2 sm:mx-4 min-w-[150px] sm:min-w-0">
              {`Pedido ${currentOrderIndex + 1} de ${accumulatedOrders.length}`}
            </span>

            {/* Next Button - text then icon */}
            <button
              onClick={handleNextOrder}
              disabled={currentOrderIndex === accumulatedOrders.length - 1}
              className="flex items-center justify-center px-3 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              title="Ir al siguiente pedido"
            >
              <span className="hidden sm:inline mr-1">Siguiente</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg shadow-md">
          {/* Table for desktop view (hidden on screens smaller than md) */}
          <table className="min-w-full divide-y divide-gray-200 hidden md:table">
            <thead className="bg-blue-600 text-white">
              <tr style={{ backgroundColor: "#2563eb", color: "#ffffff" }}>
                <th
                  scope="col"
                  className="px-1 py-px text-xs font-medium uppercase tracking-wider rounded-tl-lg whitespace-nowrap"
                >
                  Pallets
                </th>
                <th
                  scope="col"
                  className="px-1 py-px text-xs font-medium uppercase tracking-wider whitespace-nowrap"
                >
                  Especie
                </th>
                <th
                  scope="col"
                  className="px-1 py-px text-xs font-medium uppercase tracking-wider whitespace-nowrap"
                >
                  Variedad
                </th>
                <th
                  scope="col"
                  className="px-1 py-px text-xs font-medium uppercase tracking-wider whitespace-nowrap"
                >
                  Formato
                </th>
                <th
                  scope="col"
                  className="px-1 py-px text-xs font-medium uppercase tracking-wider whitespace-nowrap"
                >
                  Calibre
                </th>
                <th
                  scope="col"
                  className="px-1 py-px text-xs font-medium uppercase tracking-wider rounded-tr-lg whitespace-nowrap"
                >
                  Categoría
                </th>
                <th
                  scope="col"
                  className="px-1 py-px text-xs font-medium uppercase tracking-wider whitespace-nowrap"
                >
                  Precios FOB
                </th>
                <th
                  scope="col"
                  className="px-1 py-px text-xs font-medium uppercase tracking-wider whitespace-nowrap"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orderItems.map((item, index) => (
                <tr
                  key={item.id}
                  className={`hover:bg-gray-50 ${
                    index % 2 === 0 ? "bg-gray-50" : "bg-white"
                  } ${item.isCanceled ? "text-red-500" : ""}`}
                >
                  <td
                    className="px-1 py-px text-xs border-r whitespace-nowrap"
                    style={{ textAlign: "center" }}
                  >
                    <TableInput
                      type="number"
                      name="pallets"
                      value={item.pallets}
                      onChange={(e) => handleItemChange(item.id, e)}
                      onBlur={(e) => handleItemBlur(item.id, e)}
                      placeholder="21"
                      readOnly={item.isCanceled}
                      isCanceledProp={item.isCanceled}
                      ref={(el) => {
                        if (!tableInputRefs.current[item.id])
                          tableInputRefs.current[item.id] = {};
                        tableInputRefs.current[item.id].pallets = el;
                      }}
                    />
                  </td>
                  <td
                    className="px-1 py-px text-xs border-r whitespace-nowrap"
                    style={{ textAlign: "center" }}
                  >
                    <TableInput
                      name="especie"
                      value={item.especie}
                      onChange={(e) => handleItemChange(item.id, e)}
                      onBlur={(e) => handleItemBlur(item.id, e)}
                      placeholder="Manzana"
                      readOnly={item.isCanceled}
                      isCanceledProp={item.isCanceled}
                      {...(item.especie &&
                      item.especie.toUpperCase() === "MANZANAS"
                        ? { list: "apple-varieties" }
                        : {})}
                      ref={(el) => {
                        if (!tableInputRefs.current[item.id])
                          tableInputRefs.current[item.id] = {};
                        tableInputRefs.current[item.id].especie = el;
                      }}
                    />
                  </td>
                  <td
                    className="px-1 py-px text-xs border-r whitespace-nowrap"
                    style={{ textAlign: "center" }}
                  >
                    <TableInput
                      name="variedad"
                      value={item.variedad}
                      onChange={(e) => handleItemChange(item.id, e)}
                      onBlur={(e) => handleItemBlur(item.id, e)}
                      placeholder="Galas"
                      readOnly={item.isCanceled}
                      isCanceledProp={item.isCanceled}
                      {...(item.especie &&
                      item.especie.toUpperCase() === "MANZANAS"
                        ? { list: "apple-varieties" }
                        : {})}
                      ref={(el) => {
                        if (!tableInputRefs.current[item.id])
                          tableInputRefs.current[item.id] = {};
                        tableInputRefs.current[item.id].variedad = el;
                      }}
                    />
                  </td>
                  <td
                    className="px-1 py-px text-xs border-r whitespace-nowrap"
                    style={{ textAlign: "center" }}
                  >
                    <TableInput
                      name="formato"
                      value={item.formato}
                      onChange={(e) => handleItemChange(item.id, e)}
                      onBlur={(e) => handleItemBlur(item.id, e)}
                      placeholder="20 Kg"
                      readOnly={item.isCanceled}
                      isCanceledProp={item.isCanceled}
                      ref={(el) => {
                        if (!tableInputRefs.current[item.id])
                          tableInputRefs.current[item.id] = {};
                        tableInputRefs.current[item.id].formato = el;
                      }}
                    />
                  </td>
                  <td
                    className="px-1 py-px text-xs border-r whitespace-nowrap"
                    style={{ textAlign: "center" }}
                  >
                    <TableInput
                      name="calibre"
                      value={item.calibre}
                      onChange={(e) => handleItemChange(item.id, e)}
                      onBlur={(e) => handleItemBlur(item.id, e)}
                      placeholder="100;113"
                      readOnly={item.isCanceled}
                      isCanceledProp={item.isCanceled}
                      ref={(el) => {
                        if (!tableInputRefs.current[item.id])
                          tableInputRefs.current[item.id] = {};
                        tableInputRefs.current[item.id].calibre = el;
                      }}
                    />
                  </td>
                  <td
                    className="px-1 py-px text-xs border-r whitespace-nowrap"
                    style={{ textAlign: "center" }}
                  >
                    <TableInput
                      name="categoria"
                      value={item.categoria}
                      onChange={(e) => handleItemChange(item.id, e)}
                      onBlur={(e) => handleItemBlur(item.id, e)}
                      placeholder="PRE:XFY"
                      readOnly={item.isCanceled}
                      isCanceledProp={item.isCanceled}
                      ref={(el) => {
                        if (!tableInputRefs.current[item.id])
                          tableInputRefs.current[item.id] = {};
                        tableInputRefs.current[item.id].categoria = el;
                      }}
                    />
                  </td>
                  <td
                    className="px-1 py-px text-xs border-r whitespace-nowrap"
                    style={{ textAlign: "center" }}
                  >
                    <TableInput
                      name="preciosFOB"
                      value={item.preciosFOB}
                      onChange={(e) => handleItemChange(item.id, e)}
                      onBlur={(e) => handleItemBlur(item.id, e)}
                      placeholder="$14"
                      readOnly={item.isCanceled}
                      isCanceledProp={item.isCanceled}
                      ref={(el) => {
                        if (!tableInputRefs.current[item.id])
                          tableInputRefs.current[item.id] = {};
                        tableInputRefs.current[item.id].preciosFOB = el;
                      }}
                    />
                  </td>
                  <td className="px-1 py-px text-right text-xs font-medium flex items-center justify-center h-full">
                    {/* Updated Observation Button with a pencil-square icon */}
                    <button
                      onClick={() => handleOpenObservationModal(item.id)}
                      className="text-blue-600 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 p-1 rounded-md"
                      title="Editar Observación"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-5 w-5"
                      >
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleAddItem(item.id)}
                      className="text-green-600 hover:text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 p-1 rounded-md"
                      title="Duplicar fila"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => toggleItemCancellation(item.id)}
                      className={`ml-1 ${
                        item.isCanceled
                          ? "text-gray-600 hover:text-gray-900"
                          : "text-red-600 hover:text-red-900"
                      } focus:outline-none focus:ring-2 focus:ring-offset-2 p-1 rounded-md`}
                      title={
                        item.isCanceled
                          ? "Revertir cancelación"
                          : "Cancelar fila"
                      }
                    >
                      {item.isCanceled ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414L7.586 9H6a1 1 0 000 2h1.586l1.707 1.707a1 1 0 001.414-1.414L10.414 10H12a1 1 0 000-2h-1.586z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className={`ml-1 text-red-600 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 p-1 rounded-md ${
                        orderItems.length <= 1
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      title={
                        orderItems.length <= 1
                          ? "No se puede eliminar la última fila"
                          : "Eliminar fila"
                      }
                      disabled={orderItems.length <= 1}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm-1 4a1 1 0 002 0v-4a1 1 0 00-2 0v4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor: "#e0e0e0" }}>
                <td
                  colSpan="6"
                  style={{
                    padding: "6px 15px 6px 6px",
                    textAlign: "right",
                    fontWeight: "bold",
                    border: "1px solid #ccc",
                    borderBottomLeftRadius: "8px",
                    marginTop: "15px",
                  }}
                >
                  Total de Pallets:
                </td>
                <td
                  colSpan="1"
                  style={{
                    padding: "6px",
                    fontWeight: "bold",
                    border: "1px solid #ccc",
                    borderBottomRightRadius: "8px",
                    textAlign: "center",
                  }}
                >
                  {currentOrderTotalPallets} Pallets
                </td>
              </tr>
            </tbody>
          </table>

          {/* Mobile View - Cards for each row (hidden on screens larger than md) */}
          <div className="md:hidden space-y-4 p-2">
            {orderItems.map((item, index) => (
              <div
                key={item.id}
                className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2 ${
                  item.isCanceled ? "line-through text-red-500 opacity-70" : ""
                }`}
              >
                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-blue-600">
                    Artículo #${index + 1}
                  </span>
                  <div className="flex space-x-2">
                    {/* Updated Observation Button for mobile */}
                    <button
                      onClick={() => handleOpenObservationModal(item.id)}
                      className="text-blue-600 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 p-1 rounded-md"
                      title="Editar Observación"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-5 w-5"
                      >
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleAddItem(item.id)}
                      className="text-green-600 hover:text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 p-1 rounded-md"
                      title="Duplicar fila"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => toggleItemCancellation(item.id)}
                      className={`ml-1 ${
                        item.isCanceled
                          ? "text-gray-600 hover:text-gray-900"
                          : "text-red-600 hover:text-red-900"
                      } focus:outline-none focus:ring-2 focus:ring-offset-2 p-1 rounded-md`}
                      title={
                        item.isCanceled
                          ? "Revertir cancelación"
                          : "Cancelar fila"
                      }
                    >
                      {item.isCanceled ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414L7.586 9H6a1 1 0 000 2h1.586l1.707 1.707a1 1 0 001.414-1.414L10.414 10H12a1 1 0 000-2h-1.586z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className={`ml-1 text-red-600 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 p-1 rounded-md ${
                        orderItems.length <= 1
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      title={
                        orderItems.length <= 1
                          ? "No se puede eliminar la última fila"
                          : "Eliminar fila"
                      }
                      disabled={orderItems.length <= 1}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm-1 4a1 1 0 002 0v-4a1 1 0 00-2 0v4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-gray-500 w-1/2">
                    Pallets:
                  </span>
                  <TableInput
                    name="pallets"
                    value={item.pallets}
                    onChange={(e) => handleItemChange(item.id, e)}
                    onBlur={(e) => handleItemBlur(item.id, e)}
                    placeholder="21"
                    readOnly={item.isCanceled}
                    isCanceledProp={item.isCanceled}
                  />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-gray-500 w-1/2">
                    Especie:
                  </span>
                  <TableInput
                    name="especie"
                    value={item.especie}
                    onChange={(e) => handleItemChange(item.id, e)}
                    onBlur={(e) => handleItemBlur(item.id, e)}
                    placeholder="Manzana"
                    readOnly={item.isCanceled}
                    isCanceledProp={item.isCanceled}
                    {...(item.especie &&
                    item.especie.toUpperCase() === "MANZANAS"
                      ? { list: "apple-varieties" }
                      : {})}
                  />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-gray-500 w-1/2">
                    Variedad:
                  </span>
                  <TableInput
                    name="variedad"
                    value={item.variedad}
                    onChange={(e) => handleItemChange(item.id, e)}
                    onBlur={(e) => handleItemBlur(item.id, e)}
                    placeholder="Galas"
                    readOnly={item.isCanceled}
                    isCanceledProp={item.isCanceled}
                    {...(item.especie &&
                    item.especie.toUpperCase() === "MANZANAS"
                      ? { list: "apple-varieties" }
                      : {})}
                  />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-gray-500 w-1/2">
                    Formato:
                  </span>
                  <TableInput
                    name="formato"
                    value={item.formato}
                    onChange={(e) => handleItemChange(item.id, e)}
                    onBlur={(e) => handleItemBlur(item.id, e)}
                    placeholder="20 Kg"
                    readOnly={item.isCanceled}
                    isCanceledProp={item.isCanceled}
                  />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-gray-500 w-1/2">
                    Calibre:
                  </span>
                  <TableInput
                    name="calibre"
                    value={item.calibre}
                    onChange={(e) => handleItemChange(item.id, e)}
                    onBlur={(e) => handleItemBlur(item.id, e)}
                    placeholder="100;113"
                    readOnly={item.isCanceled}
                    isCanceledProp={item.isCanceled}
                  />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-gray-500 w-1/2">
                    Categoría:
                  </span>
                  <TableInput
                    name="categoria"
                    value={item.categoria}
                    onChange={(e) => handleItemChange(item.id, e)}
                    onBlur={(e) => handleItemBlur(item.id, e)}
                    placeholder="PRE:XFY"
                    readOnly={item.isCanceled}
                    isCanceledProp={item.isCanceled}
                  />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-gray-500 w-1/2">
                    Precios FOB:
                  </span>
                  <TableInput
                    name="preciosFOB"
                    value={item.preciosFOB}
                    onChange={(e) => handleItemChange(item.id, e)}
                    onBlur={(e) => handleItemBlur(item.id, e)}
                    placeholder="$14"
                    readOnly={item.isCanceled}
                    isCanceledProp={item.isCanceled}
                  />
                </div>
              </div>
            ))}
            {/* Mobile Total Pallets outside of individual item cards */}
            <div className="bg-blue-100 border border-blue-200 rounded-lg py-2 px-3 shadow-sm text-center font-bold text-base text-blue-800 mt-4">
              Total de Pallets: {currentOrderTotalPallets} Pallets
            </div>
          </div>
        </div>

        {/* Combined Action Buttons: Agregar Pedido & Finalizar Pedido */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
          <button
            onClick={handleAddOrder}
            className="flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-150 ease-in-out transform hover:scale-105 w-full sm:w-auto"
            title="Crear un nuevo pedido en blanco"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                clipRule="evenodd"
              />
            </svg>
            Agregar Pedido
          </button>

          <button
            onClick={handleFinalizeOrder}
            className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out transform hover:scale-105 w-full sm:w-auto"
            title="Finalizar el pedido y ver opciones de envío"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Finalizar Pedido
          </button>
        </div>

        {/* Unified Order Actions Modal */}
        {showOrderActionsModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-screen-lg mx-auto my-8 relative flex flex-col max-h-[90vh]">
              <h2 className="text-xl font-bold mb-4 text-gray-800 text-center">
                Opciones de Pedido Finalizado
              </h2>

              {!isShowingPreview && (
                <h3 className="text-sm text-gray-600 text-center mb-4 leading-relaxed">
                  <strong>Instrucción importante:</strong> Después de enviar el
                  email, abre tu aplicación de correo y pega (Ctrl+V o Cmd+V) el
                  contenido manualmente en el cuerpo del mensaje.
                </h3>
              )}

              {!isShowingPreview ? (
                <div className="flex justify-center gap-4 mb-4 flex-wrap sm:flex-nowrap">
                  <button
                    onClick={handlePreviewOrder}
                    className="flex items-center justify-center px-4 py-2 text-sm bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition duration-150 ease-in-out transform hover:scale-105 w-full sm:w-auto"
                    title="Previsualizar el pedido completo"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8 4a4 4 0 100 8c1.65 0 3-1.35 3-3V7a1 1 0 112 0v1a5 5 0 01-5 5H4a5 5 0 01-5-5v-1c0-1.65 1.35-3 3-3h1V4a1 1 0 11-2 0V3h-1a1 1 0 110-2h1a1 1 0 011 1v1h1a1 1 0 011 1V4zm0 2a2 2 0 100 4 2 2 0 000-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Previsualizar
                  </button>
                  <button
                    onClick={performSendEmail}
                    className="flex items-center justify-center px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out transform hover:scale-105 w-full sm:w-auto"
                    title="Copiar contenido y abrir cliente de correo"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                    Enviar Email
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 text-center">
                    Previsualización del Pedido
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200 text-left flex-grow overflow-y-auto">
                    <div
                      dangerouslySetInnerHTML={{ __html: previewHtmlContent }}
                    />
                  </div>
                  <div className="flex justify-center mt-3 gap-2 flex-wrap sm:flex-nowrap">
                    <button
                      onClick={() => setIsShowingPreview(false)}
                      className="flex items-center justify-center px-4 py-2 text-sm bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition duration-150 ease-in-out transform hover:scale-105 w-full sm:w-auto"
                    >
                      Volver a Opciones
                    </button>
                    <button
                      onClick={performSendEmail}
                      className="flex items-center justify-center px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out transform hover:scale-105 w-full sm:w-auto"
                      title="Copiar contenido y abrir cliente de correo"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      Enviar Email
                    </button>
                  </div>
                </>
              )}

              <div className="flex justify-center mt-4">
                <button
                  onClick={() => setShowOrderActionsModal(false)}
                  className="px-6 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-150 ease-in-out"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Observation Modal */}
        {showObservationModal && currentEditingItemData && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-auto relative">
              <h2 className="text-xl font-bold mb-4 text-gray-800 text-center">
                Editar Observación para Línea
              </h2>
              <div className="mb-4">
                <label
                  htmlFor="modalObservation"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Observación:
                </label>
                <textarea
                  id="modalObservation"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 bg-gray-50 border"
                  rows="4"
                  value={modalObservationText}
                  onChange={(e) => setModalObservationText(e.target.value)}
                  placeholder="Ingrese la observación aquí..."
                  ref={observationTextareaRef}
                ></textarea>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCloseObservationModal}
                  className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition duration-150 ease-in-out"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveObservation}
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Datalist for "Variedad" field (apple varieties) */}
      <datalist id="apple-varieties">
        <option value="GALA" />
        <option value="GRANNY" />
        <option value="FUJI" />
        <option value="PINK LADY" />
        <option value="ROJA" />
        <option value="CRIPPS PINK" />
      </datalist>
    </div>
  );
};

export default App;
