import React, { useState, useEffect, useRef } from "react"; // Import useRef

// Component for rendering a single input field with styling
const InputField = React.forwardRef(
  (
    {
      label,
      name,
      value,
      onChange,
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
          id={name}
          name={name}
          value={safeValue} // Use the safeValue
          onChange={onChange}
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
      type = "text",
      placeholder = "",
      readOnly = false,
      isCanceledProp = false,
    },
    ref
  ) => {
    // Ensure value is explicitly a string, falling back to an empty string if null/undefined
    const safeValue =
      value === null || value === undefined ? "" : String(value);
    return (
      <input
        type={type}
        id={`${name}-${safeValue}`} // Added unique ID for better accessibility if needed
        name={name}
        value={safeValue} // Use the safeValue
        onChange={onChange}
        placeholder={placeholder}
        // Apply line-through directly to the input if canceled
        className={`w-full h-full p-px border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-md ${
          isCanceledProp ? "line-through" : ""
        }`}
        ref={ref} // Pass the ref here
        readOnly={readOnly} // Apply readOnly property
      />
    );
  }
);

// Main App component
const App = () => {
  // State for current order header information
  const [headerInfo, setHeaderInfo] = useState({
    reDestinatarios: "",
    deNombrePais: "",
    nave: "",
    fechaCarga: "",
    exporta: "",
    emailSubject: "", // Subject for the overall email, auto-completed based on first order
  });

  // State for current order items (table rows)
  const [orderItems, setOrderItems] = useState([
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
  ]);

  // State to store all accumulated orders
  const [accumulatedOrders, setAccumulatedOrders] = useState([]);

  // State to control the visibility of the email content modal
  const [showEmailContent, setShowEmailContent] = useState(false);

  // Refs for managing focusable elements (still useful for general navigation)
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
  // Define the order of table columns for navigation
  const tableColumnOrder = [
    "pallets",
    "especie",
    "variedad",
    "formato",
    "calibre",
    "categoria",
    "preciosFOB",
    "estado",
  ];

  // Function to get current ISO week number
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

  // Function to generate the email subject based on template
  const generateEmailSubjectValue = (proveedores, especies) => {
    const weekNumber = getCurrentWeekNumber();

    const formatPart = (arr, defaultValue) => {
      const safeArr = Array.isArray(arr) ? arr : [];
      const uniqueValues = Array.from(new Set(safeArr))
        .filter((val) => typeof val === "string" && val.trim() !== "")
        .map((val) => val.toUpperCase().replace(/[^A-Z0-9]/g, ""));
      return uniqueValues.length > 0 ? uniqueValues.join("-") : defaultValue;
    };

    const formattedProveedor = formatPart(proveedores, "PROVEEDOR");
    const formattedEspecie = formatPart(especies, "ESPECIES");

    return `PED–W${weekNumber}–${formattedProveedor}–${formattedEspecie}`;
  };

  // Effect to synchronize the email subject based on relevant header fields and first item details of the CURRENT order
  useEffect(() => {
    const currentProveedor = headerInfo.reDestinatarios;
    const currentEspecie = orderItems[0]?.especie || "";

    const newSubjectForCurrentOrder = generateEmailSubjectValue(
      [currentProveedor],
      [currentEspecie]
    );

    if (newSubjectForCurrentOrder !== headerInfo.emailSubject) {
      setHeaderInfo((prevInfo) => ({
        ...prevInfo,
        emailSubject: newSubjectForCurrentOrder,
      }));
    }
  }, [
    headerInfo.reDestinatarios,
    orderItems[0]?.especie,
    headerInfo.emailSubject,
  ]);

  // Handle changes in header input fields
  const handleHeaderChange = (e) => {
    const { name, value, type } = e.target;
    setHeaderInfo((prevInfo) => {
      let newValue = value;
      if (type !== "date" && type !== "number" && name !== "emailSubject") {
        newValue = value.toUpperCase();
      }
      return { ...prevInfo, [name]: newValue };
    });
  };

  // Handle changes in order item table input fields
  const handleItemChange = (itemId, e) => {
    const { name, value, type } = e.target;
    setOrderItems((prevItems) => {
      return prevItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [name]:
                name === "estado" || type === "number" || name === "preciosFOB" // If it's 'estado' or a number field or preciosFOB
                  ? value // Keep value as is
                  : value.toUpperCase(), // Convert other text fields to uppercase
            }
          : item
      );
    });
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
            estado: newIsCanceled ? "CANCELADO" : "", // Set to CANCELADO or clear
          };
        }
        return item;
      });
    });
  };

  // Calculate the total number of pallets for the CURRENT order
  const currentOrderTotalPallets = orderItems.reduce((sum, item) => {
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
    const singleOrderTotalPallets = orderItemsData.reduce((sum, item) => {
      const pallets = parseFloat(item.pallets) || 0;
      return sum + pallets;
    }, 0);

    const formattedNave = orderHeader.nave;
    const formattedPais = orderHeader.deNombrePais;
    const formattedFechaCarga = formatDateToSpanish(orderHeader.fechaCarga);
    const formattedExporta = orderHeader.exporta;

    return `
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; border-radius: 8px; position: relative;">
            <p style="margin-bottom: 5px;"><strong>País:</strong> <u>${formattedPais}</u></p>
            <p style="margin-bottom: 5px;"><strong>Nave:</strong> ${formattedNave}</p>
            <p style="margin-bottom: 5px;"><strong>Fecha de carga:</strong> ${formattedFechaCarga}</p>
            <p style="margin-bottom: 15px;"><strong>Exporta:</strong> ${formattedExporta}</p>

            <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                <thead>
                    <tr style="background-color: #2563eb; color: #ffffff;">
                        <th style="padding: 5px 8px; border: 1px solid #1e40af; border-top-left-radius: 8px; text-align: center;">Pallets</th><th style="padding: 5px 8px; border: 1px solid #1e40af; text-align: center;">Especie</th><th style="padding: 5px 8px; border: 1px solid #1e40af; text-align: center;">Variedad</th><th style="padding: 5px 8px; border: 1px solid #1e40af; text-align: center;">Formato</th><th style="padding: 5px 8px; border: 1px solid #1e40af; text-align: center;">Calibre</th><th style="padding: 5px 8px; border: 1px solid #1e40af; text-align: center;">Categoría</th><th style="padding: 5px 8px; border: 1px solid #1e40af; text-align: center;">Precios FOB</th><th style="padding: 5px 8px; border: 1px solid #1e40af; border-top-right-radius: 8px; text-align: center;">Observaciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${orderItemsData
                      .map((item, idx) => {
                        const itemStyle = item.isCanceled
                          ? "color: red; text-decoration: line-through;"
                          : "";
                        return (
                          `<tr style="${
                            idx % 2 === 0
                              ? "background-color: #f9f9f9;"
                              : "background-color: #ffffff;"
                          }${itemStyle}">` +
                          `<td style="padding: 4px 6px; border: 1px solid #eee; text-align: center;">${item.pallets}</td>` +
                          `<td style="padding: 4px 6px; border: 1px solid #eee; text-align: center;">${item.especie}</td>` +
                          `<td style="padding: 4px 6px; border: 1px solid #eee; text-align: center;">${item.variedad}</td>` +
                          `<td style="padding: 4px 6px; border: 1px solid #eee; text-align: center;">${item.formato}</td>` +
                          `<td style="padding: 4px 6px; border: 1px solid #eee; text-align: center;">${item.calibre}</td>` +
                          `<td style="padding: 4px 6px; border: 1px solid #eee; text-align: center;">${item.categoria}</td>` +
                          `<td style="padding: 4px 6px; border: 1px solid #eee; text-align: center;">${
                            item.preciosFOB ? "$ " + item.preciosFOB : ""
                          }</td>` +
                          `<td style="padding: 4px 6px; border: 1px solid #eee; text-align: center;"><strong>${item.estado}</strong></td>` +
                          `</tr>`
                        );
                      })
                      .join("")}
                    <tr style="background-color: #e0e0e0;">
                        <td colSpan="7" style="padding: 6px 15px 6px 6px; text-align: right; font-weight: bold; border: 1px solid #ccc; border-bottom-left-radius: 8px; margin-top: 15px;">Total de Pallets:</td>
                        <td colSpan="1" style="padding: 6px; font-weight: bold; border: 1px solid #ccc; border-bottom-right-radius: 8px; text-align: center;">
                          ${singleOrderTotalPallets} Pallets
                        </td>
                        <td colSpan="1" style={{ padding: '0px 4px 0px 4px' }}></td>
                    </tr>
                </tbody>
            </table>
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

  // Handler for "Agregar Pedido" button
  const handleAddOrder = () => {
    const hasData =
      orderItems.some(
        (item) =>
          item.pallets ||
          item.especie ||
          item.variedad ||
          item.formato ||
          item.calibre ||
          item.categoria ||
          item.preciosFOB ||
          item.estado
      ) ||
      headerInfo.reDestinatarios ||
      headerInfo.deNombrePais ||
      headerInfo.nave ||
      headerInfo.fechaCarga ||
      headerInfo.exporta;

    if (hasData) {
      setAccumulatedOrders((prevOrders) => [
        ...prevOrders,
        {
          header: { ...headerInfo },
          items: orderItems.map((item) => ({ ...item })),
        },
      ]);

      setOrderItems([
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
      ]);
      // Reset header info to ensure new order starts fresh
      setHeaderInfo((prevInfo) => ({
        reDestinatarios: "",
        deNombrePais: "",
        nave: "",
        fechaCarga: "",
        exporta: "",
        emailSubject: generateEmailSubjectValue([], []), // Generate a default subject for the new empty order
      }));
    } else {
      console.log(
        "El pedido actual está vacío. Por favor, ingrese información antes de agregarlo."
      );
    }
  };

  // Function to handle the "Enviar Email" action
  const handleSendEmail = () => {
    const finalOrdersForEmail = [...accumulatedOrders];

    const currentOrderHasMeaningfulTableData = orderItems.some(
      (item) =>
        item.pallets.trim() !== "" ||
        item.especie.trim() !== "" ||
        item.variedad.trim() !== "" ||
        item.formato.trim() !== "" ||
        item.calibre.trim() !== "" ||
        item.categoria.trim() !== "" ||
        item.preciosFOB.trim() !== "" ||
        item.estado.trim() !== ""
    );

    const isCurrentOrderDuplicateOfLast =
      finalOrdersForEmail.length > 0 &&
      JSON.stringify(
        finalOrdersForEmail[finalOrdersForEmail.length - 1].header
      ) === JSON.stringify(headerInfo) &&
      JSON.stringify(
        finalOrdersForEmail[finalOrdersForEmail.length - 1].items
      ) === JSON.stringify(orderItems);

    if (currentOrderHasMeaningfulTableData && !isCurrentOrderDuplicateOfLast) {
      finalOrdersForEmail.push({
        header: { ...headerInfo },
        items: orderItems.map((item) => ({ ...item })),
      });
    }

    if (finalOrdersForEmail.length === 0) {
      console.log("No hay pedidos para enviar.");
      setShowEmailContent(true);
      return;
    }

    let fullEmailBodyHtml = "";
    const allProveedores = new Set();
    const allEspecies = new Set();

    finalOrdersForEmail.forEach((order, index) => {
      fullEmailBodyHtml += `
          <h3 style="font-size: 18px; color: #2563eb; margin-top: 40px; margin-bottom: 15px;">Pedido #${
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

    copyFormattedContentToClipboard(fullEmailBodyHtml);

    const consolidatedSubject = generateEmailSubjectValue(
      Array.from(allProveedores),
      Array.from(allEspecies)
    );

    const recipient = "";
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${recipient}&su=${encodeURIComponent(
        consolidatedSubject
      )}&body=`,
      "_blank"
    );

    setShowEmailContent(true);

    // Reset all states after sending email
    setAccumulatedOrders([]);
    setHeaderInfo((prevInfo) => ({
      reDestinatarios: "",
      deNombrePais: "",
      nave: "",
      fechaCarga: "",
      exporta: "",
      emailSubject: generateEmailSubjectValue([], []),
    }));
    setOrderItems([
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
    ]);
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
          } else if (e.key === "ArrowDown") {
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
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 sm:p-8 space-y-6 relative">
        <img
          src="https://www.vpcom.com/images/logo-vpc.png"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src =
              "https://placehold.co/100x40/FFFFFF/000000?text=LogoVPC";
          }}
          alt="Logo VPC"
          className="absolute top-4 right-4 w-24 h-auto sm:w-32 object-contain rounded-md"
        />

        <div className="border-b pb-4 mb-4">
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
                placeholder="Asunto del Correo (Se auto-completa)"
                ref={(el) => (headerInputRefs.current.emailSubject = el)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg shadow-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-blue-600 text-white">
              <tr style={{ backgroundColor: "#2563eb", color: "#ffffff" }}>
                <th
                  scope="col"
                  className="px-1 py-0.5 w-[7%] text-center text-xs font-medium uppercase tracking-wider rounded-tl-lg"
                >
                  Pallets
                </th>
                <th
                  scope="col"
                  className="px-1 py-0.5 w-[13%] text-center text-xs font-medium uppercase tracking-wider"
                >
                  Especie
                </th>
                <th
                  scope="col"
                  className="px-1 py-0.5 w-[13%] text-center text-xs font-medium uppercase tracking-wider"
                >
                  Variedad
                </th>
                <th
                  scope="col"
                  className="px-1 py-0.5 w-[10%] text-center text-xs font-medium uppercase tracking-wider"
                >
                  Formato
                </th>
                <th
                  scope="col"
                  className="px-1 py-0.5 w-[12%] text-center text-xs font-medium uppercase tracking-wider"
                >
                  Calibre
                </th>
                <th
                  scope="col"
                  className="px-1 py-0.5 w-[14%] text-center text-xs font-medium uppercase tracking-wider"
                >
                  Categoría
                </th>
                <th
                  scope="col"
                  className="px-1 py-0.5 w-[10%] text-center text-xs font-medium uppercase tracking-wider"
                >
                  Precios FOB
                </th>
                <th
                  scope="col"
                  className="px-1 py-0.5 w-[15%] text-center text-xs font-medium uppercase tracking-wider rounded-tr-lg"
                >
                  Observaciones
                </th>
                <th
                  scope="col"
                  className="px-1 py-0.5 w-[6%] text-center text-xs font-medium uppercase tracking-wider"
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
                  <td className="px-1 py-px text-sm border-r text-center">
                    <TableInput
                      type="number"
                      name="pallets"
                      value={item.pallets}
                      onChange={(e) => handleItemChange(item.id, e)}
                      placeholder="Ej. 21"
                      readOnly={item.isCanceled}
                      isCanceledProp={item.isCanceled}
                      ref={(el) => {
                        if (el) {
                          if (!tableInputRefs.current[item.id]) {
                            tableInputRefs.current[item.id] = {};
                          }
                          tableInputRefs.current[item.id].pallets = el;
                        }
                      }}
                    />
                  </td>
                  <td className="px-1 py-px text-sm border-r text-center">
                    <TableInput
                      name="especie"
                      value={item.especie}
                      onChange={(e) => handleItemChange(item.id, e)}
                      placeholder="Ej. Manzana"
                      readOnly={item.isCanceled}
                      isCanceledProp={item.isCanceled}
                      ref={(el) => {
                        if (el) {
                          if (!tableInputRefs.current[item.id]) {
                            tableInputRefs.current[item.id] = {};
                          }
                          tableInputRefs.current[item.id].especie = el;
                        }
                      }}
                    />
                  </td>
                  <td className="px-1 py-px text-sm border-r text-center">
                    <TableInput
                      name="variedad"
                      value={item.variedad}
                      onChange={(e) => handleItemChange(item.id, e)}
                      placeholder="Ej. Galas"
                      readOnly={item.isCanceled}
                      isCanceledProp={item.isCanceled}
                      ref={(el) => {
                        if (el) {
                          if (!tableInputRefs.current[item.id]) {
                            tableInputRefs.current[item.id] = {};
                          }
                          tableInputRefs.current[item.id].variedad = el;
                        }
                      }}
                    />
                  </td>
                  <td className="px-1 py-px text-sm border-r text-center">
                    <TableInput
                      name="formato"
                      value={item.formato}
                      onChange={(e) => handleItemChange(item.id, e)}
                      placeholder="Ej. 20 Kg"
                      readOnly={item.isCanceled}
                      isCanceledProp={item.isCanceled}
                      ref={(el) => {
                        if (el) {
                          if (!tableInputRefs.current[item.id]) {
                            tableInputRefs.current[item.id] = {};
                          }
                          tableInputRefs.current[item.id].formato = el;
                        }
                      }}
                    />
                  </td>
                  <td className="px-1 py-px text-sm border-r text-center">
                    <TableInput
                      name="calibre"
                      value={item.calibre}
                      onChange={(e) => handleItemChange(item.id, e)}
                      placeholder="Ej. 100;113"
                      readOnly={item.isCanceled}
                      isCanceledProp={item.isCanceled}
                      ref={(el) => {
                        if (el) {
                          if (!tableInputRefs.current[item.id]) {
                            tableInputRefs.current[item.id] = {};
                          }
                          tableInputRefs.current[item.id].calibre = el;
                        }
                      }}
                    />
                  </td>
                  <td className="px-1 py-px text-sm border-r text-center">
                    <TableInput
                      name="categoria"
                      value={item.categoria}
                      onChange={(e) => handleItemChange(item.id, e)}
                      placeholder="Ej. PRE:XFY"
                      readOnly={item.isCanceled}
                      isCanceledProp={item.isCanceled}
                      ref={(el) => {
                        if (el) {
                          if (!tableInputRefs.current[item.id]) {
                            tableInputRefs.current[item.id] = {};
                          }
                          tableInputRefs.current[item.id].categoria = el;
                        }
                      }}
                    />
                  </td>
                  <td className="px-1 py-px text-sm border-r text-center">
                    <TableInput
                      name="preciosFOB"
                      value={item.preciosFOB}
                      onChange={(e) => handleItemChange(item.id, e)}
                      placeholder="Ej. $14"
                      readOnly={item.isCanceled}
                      isCanceledProp={item.isCanceled}
                      ref={(el) => {
                        if (el) {
                          if (!tableInputRefs.current[item.id]) {
                            tableInputRefs.current[item.id] = {};
                          }
                          tableInputRefs.current[item.id].preciosFOB = el;
                        }
                      }}
                    />
                  </td>
                  <td className="px-1 py-px text-sm border-r text-center">
                    <TableInput
                      name="estado"
                      value={item.estado}
                      onChange={(e) => handleItemChange(item.id, e)}
                      placeholder="Ingrese comentarios"
                      readOnly={item.isCanceled} // Make read-only if canceled
                      isCanceledProp={item.isCanceled} // Pass prop to TableInput
                      ref={(el) => {
                        if (el) {
                          if (!tableInputRefs.current[item.id]) {
                            tableInputRefs.current[item.id] = {};
                          }
                          tableInputRefs.current[item.id].estado = el;
                        }
                      }}
                    />
                  </td>
                  <td className="px-1 py-px text-right text-sm font-medium flex items-center justify-center h-full">
                    {/* Duplicate Button (+) */}
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
                    {/* Toggle Cancel/Revert Button (X / Revert) */}
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
                        // Revert icon (circular arrow)
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
                        // X icon for cancel
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
                    {/* Delete Button (Trash Can) */}
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
                      disabled={orderItems.length <= 1} // Disable the button
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
                  colSpan="7"
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
                <td colSpan="1" style={{ padding: "0px 4px 0px 4px" }}></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
          <button
            onClick={handleAddOrder}
            className="flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-150 ease-in-out transform hover:scale-105"
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
            Agregar Pedido{" "}
            {accumulatedOrders.length > 0 &&
              `(${accumulatedOrders.length} acumulados)`}
          </button>

          <button
            onClick={handleSendEmail}
            className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out transform hover:scale-105"
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

        {showEmailContent && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
              <h2 className="text-xl font-bold mb-6 text-gray-800">
                Email Preparado
              </h2>
              <p className="mb-6 text-gray-700">
                Se ha copiado el contenido del correo electrónico al
                portapapeles y se ha abierto Gmail.
                <br />
                Ahora, **pega (Ctrl+V o Cmd+V)** el contenido directamente en el
                cuerpo del correo.
              </p>
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => setShowEmailContent(false)}
                  className="px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition duration-150 ease-in-out"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
