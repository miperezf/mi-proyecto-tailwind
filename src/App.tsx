import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  // deleteDoc, // Removed hard delete
  onSnapshot,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

// Configuración de Firebase usando variables de entorno de Vite
// Es crucial que las variables de entorno en Vite comiencen con `VITE_`
// Note: In the Canvas environment, __firebase_config and __initial_auth_token are provided globally.
// This setup assumes a Vite environment for local development, and will fall back to global vars if available.
const firebaseConfig =
  typeof __firebase_config !== "undefined"
    ? JSON.parse(__firebase_config)
    : {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
      };

// Initialize Firebase outside the component to prevent re-initializations
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log("Firebase Init: App initialized.");
console.log("Firebase Init: Config used:", firebaseConfig);

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
      list, // Add list prop for datalist
      readOnly = false, // Add readOnly prop
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
          list={list} // Pass the list prop here
          readOnly={readOnly} // Apply readOnly property
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
    // Ensure value is explicitly a string, falling back to an an empty string if null/undefined
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
  // Using projectId as appId for the Firestore collection path, prioritizing __app_id
  const appId =
    typeof __app_id !== "undefined" ? __app_id : firebaseConfig.projectId;
  console.log("App Init: Using appId:", appId);

  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false); // To know when authentication is ready
  const [isLoading, setIsLoading] = useState(true); // Loading state for data fetching
  const [allOrdersFromFirestore, setAllOrdersFromFirestore] = useState([]); // Stores raw data from Firestore
  const [displayedOrders, setDisplayedOrders] = useState([]); // Orders currently displayed (after search filter)

  // State for search functionality
  const [searchTerm, setSearchTerm] = useState("");
  const [committedSearchTerm, setCommittedSearchTerm] = useState(""); // New state for search triggered by button

  // State to explicitly track the ID of the currently active order being edited
  const [activeOrderId, setActiveOrderId] = useState(null);

  // Firebase Initialization and Authentication Effect
  useEffect(() => {
    const initAuth = async () => {
      try {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            // User is signed in (either from __initial_auth_token or anonymous fallback)
            setUserId(user.uid);
            setIsAuthReady(true);
            console.log(
              "Firebase Auth: User authenticated with UID:",
              user.uid
            );
          } else {
            // No user is signed in, attempt anonymous sign-in as a fallback
            console.log(
              "Firebase Auth: No user detected, attempting anonymous sign-in."
            );
            try {
              // Attempt to sign in with the custom token if available
              if (
                typeof __initial_auth_token !== "undefined" &&
                __initial_auth_token
              ) {
                await signInWithCustomToken(auth, __initial_auth_token);
                console.log("Firebase Auth: Signed in with custom token.");
                setUserId(auth.currentUser?.uid); // Ensure userId is updated after signIn
              } else {
                await signInAnonymously(auth);
                console.log("Firebase Auth: Signed in anonymously.");
                setUserId(auth.currentUser?.uid); // Ensure userId is updated after signIn
              }
            } catch (anonError) {
              console.error(
                "Firebase Auth: Error attempting sign-in (fallback or token):",
                anonError
              );
              // If all fails, provide a UUID for local operations, though they won't sync with Firestore
              setUserId(crypto.randomUUID());
            } finally {
              setIsAuthReady(true); // Mark as ready after all attempts
            }
          }
        });

        // Cleanup listener on component unmount
        return () => unsubscribe();
      } catch (error) {
        console.error(
          "Firebase Auth: Error initializing Firebase Auth:",
          error
        );
        setIsAuthReady(true); // Mark as ready even if Firebase init fails
      }
    };

    initAuth();
  }, []); // Empty dependency array means this runs once on mount

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

  // --- NEW: Normalization map for species names ---
  // Define a map of species name variations to their normalized form.
  const SPECIES_NORMALIZATION_MAP = {
    MANZANA: "MANZANA",
    MANZANAS: "MANZANA",
    MZ: "MANZANA",
    APPLE: "MANZANA",
    APPLES: "MANZANA",

    PERA: "PERA",
    PERAS: "PERA",
    PR: "PERA",
    PEAR: "PERA",
    PEARS: "PERA",

    UVA: "UVA",
    UVAS: "UVA",
    GRAPE: "UVA",
    GRAPES: "UVA",
    UV: "UVA",

    KIWI: "KIWI",
    KIWIS: "KIWI", // Added Kiwis

    NARANJA: "NARANJA",
    NARANJAS: "NARANJA", // Added Naranjas

    LIMON: "LIMON",
    LIMONES: "LIMON", // Added Limon
    LM: "LIMON",

    CEREZA: "CEREZA",
    CEREZAS: "CEREZA", // Added Cerezas

    CLEMENTINA: "CLEMENTINA",
    CLEMENTINAS: "CLEMENTINA", // Added Clementinas

    CIRUELA: "CIRUELA",
    CIRUELAS: "CIRUELA", // Added Ciruelas

    DURAZNO: "DURAZNO",
    DURAZNOS: "DURAZNO", // Added Duraznos

    NECTARIN: "NECTARIN",
    NECTARINES: "NECTARIN", // Added Nectarines

    // You can add more species and their variations here:
    // 'VARIATION1': 'NORMALIZED_NAME',
    // 'VARIATION2': 'NORMALIZED_NAME',
  };

  // --- NEW: Function to normalize a species name ---
  const normalizeSpeciesName = (name) => {
    if (typeof name !== "string" || name.trim() === "") {
      return ""; // Return empty if not a string or empty
    }
    const upperName = name.toUpperCase().trim();
    // Look up in the map; if not found, return the uppercase name as is
    return SPECIES_NORMALIZATION_MAP[upperName] || upperName;
  };

  // Function to generate the email subject based on template (moved outside)
  const generateEmailSubjectValue = (
    proveedores,
    especies,
    mailGlobalId = "" // mailGlobalId is passed but not used in the subject string
  ) => {
    const weekNumber = getCurrentWeekNumber();

    const formatPart = (arr, defaultValue) => {
      const safeArr = Array.isArray(arr) ? arr : [];
      // --- KEY MODIFICATION: Normalize and then filter for uniqueness ---
      const uniqueValues = Array.from(
        new Set( // <--- CORRECTED: Added 'new'
          safeArr
            .filter((val) => typeof val === "string" && val.trim() !== "")
            .map((val) => normalizeSpeciesName(val)) // Apply normalization here
        )
      );
      return uniqueValues.length > 0 ? uniqueValues.join("-") : defaultValue;
    };

    // Ensure only the first unique supplier name is used, or a default.
    const uniqueProveedores = Array.from(
      new Set(Array.isArray(proveedores) ? proveedores : []) // <--- CORRECTED: Added 'new'
    ).filter((val) => typeof val === "string" && val.trim() !== "");
    const formattedProveedor =
      uniqueProveedores.length > 0
        ? uniqueProveedores[0].toUpperCase().replace(/[^A-Z0-9]/g, "")
        : "PROVEEDOR";

    // Pass species names directly to `formatPart`, which will now normalize them.
    const formattedEspecie = formatPart(especies, "ESPECIE");

    const subject = `PED–W${weekNumber}–${formattedProveedor}–${formattedEspecie}`;
    // mailGlobalId is intentionally NOT appended to the subject here
    return subject;
  };

  // Define initial blank states for header and items
  const initialHeaderState = {
    reDestinatarios: "",
    deNombrePais: "",
    nave: "",
    fechaCarga: "",
    exporta: "",
    emailSubject: "", // Email subject is generated dynamically
    mailId: "", // Field to store the Mail ID associated with the email send
    status: "draft", // New status field: 'draft', 'sent', or 'deleted'
    createdAt: null, // New field to store timestamp for sorting
    createdBy: null, // New field to store the userId of the creator
    lastModifiedBy: null, // New field to store the userId of the last modifier
    updatedAt: null, // New field to store timestamp of last update
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

  // State to track the index of the currently edited order within displayedOrders
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

  // Define the order of header inputs for navigation (Mail ID removed from UI)
  const headerInputOrder = [
    "reDestinatarios",
    "deNombrePais",
    "nave",
    "fechaCarga",
    "exporta",
    "emailSubject",
    // Removed "mailId" from here as per user request to remove input
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

  // Firestore: Save/Update Order Document
  const saveOrderToFirestore = async (orderToSave) => {
    console.log("Firestore: saveOrderToFirestore called.");
    if (!db || !userId) {
      console.warn(
        "Firestore: Not initialized or user not authenticated. Cannot save order."
      );
      return;
    }
    try {
      // MODIFIED: The collection now points to a public path
      const ordersCollectionRef = collection(
        db,
        `artifacts/${appId}/public/data/pedidos`
      );
      const { header, items } = orderToSave;

      // Key logic: if orderToSave.id is provided, use it. Otherwise, generate a new one.
      const orderDocId = orderToSave.id || doc(ordersCollectionRef).id;
      console.log(
        "Firestore: Saving order with ID:",
        orderDocId,
        "Data passed:",
        orderToSave
      );

      const dataToSave = {
        header: {
          ...header,
          lastModifiedBy: userId, // Update the user who last modified
          updatedAt: Date.now(), // Update the last modification timestamp
        },
        items: JSON.stringify(items), // Stringify the array of item objects
      };

      console.log("Firestore: Data to be saved:", dataToSave);

      const orderDocRef = doc(ordersCollectionRef, orderDocId);
      await setDoc(orderDocRef, dataToSave);
      console.log("Firestore: Order saved/updated successfully:", orderDocId);
    } catch (error) {
      console.error("Firestore: Error saving/updating order:", error);
      throw error; // Re-throw the error so calling functions can catch it
    }
  };

  // Firestore: Soft Delete Order Document (mark as deleted)
  const handleSoftDeleteOrderInFirestore = async (orderDocIdToDelete) => {
    console.log(
      "Firestore: handleSoftDeleteOrderInFirestore called for ID:",
      orderDocIdToDelete
    );
    if (!db || !userId) {
      console.warn(
        "Firestore: Not initialized or user not authenticated. Cannot soft delete order."
      );
      return;
    }
    try {
      const orderDocRef = doc(
        db,
        `artifacts/${appId}/public/data/pedidos`,
        orderDocIdToDelete
      );
      console.log(
        "Firestore: Attempting to mark document as 'deleted':",
        orderDocIdToDelete
      );
      await updateDoc(orderDocRef, {
        "header.status": "deleted",
        "header.lastModifiedBy": userId,
        "header.updatedAt": Date.now(),
      });
      console.log(
        "Firestore: Document marked as 'deleted' successfully for ID:",
        orderDocIdToDelete
      );
    } catch (error) {
      console.error("Firestore: Error marking order as deleted:", error);
    }
  };

  // Effect to synchronize the email subject based on relevant header fields and first item details of the CURRENT order
  useEffect(() => {
    const currentProveedor = headerInfo.reDestinatarios;
    // Pass only the first species of the first item (or empty if none)
    const currentEspecie = orderItems[0]?.especie || "";

    const newSubjectForCurrentOrder = generateEmailSubjectValue(
      [currentProveedor],
      // Here an array is passed that can contain the main species for the subject
      [currentEspecie],
      headerInfo.mailId // Pass the mailId from headerInfo for subject generation (though it's not used in the subject string itself now)
    );

    // Only update if the new subject is different to avoid unnecessary re-renders
    if (newSubjectForCurrentOrder !== headerInfo.emailSubject) {
      console.log(
        "Subject Effect: Updating email subject from",
        headerInfo.emailSubject,
        "to",
        newSubjectForCurrentOrder
      );
      setHeaderInfo((prevInfo) => ({
        ...prevInfo,
        emailSubject: newSubjectForCurrentOrder,
      }));
    }
  }, [
    headerInfo.reDestinatarios,
    orderItems[0]?.especie, // Dependency so the subject updates if the first item's species changes
    headerInfo.emailSubject, // Keep this dependency to trigger update if manual edit happens
    headerInfo.mailId, // mailId is still a dependency because it might trigger a subject update if the mailId itself changes.
  ]);

  // Firestore: Effect to load and listen for real-time order data
  useEffect(() => {
    if (!db || !userId || !isAuthReady) {
      console.log(
        "Firestore Listener: Firestore, userId, or auth not ready for data fetching."
      );
      return;
    }

    setIsLoading(true);
    // MODIFIED: The collection now points to a public path
    const ordersCollectionRef = collection(
      db,
      `artifacts/${appId}/public/data/pedidos`
    );
    console.log(
      "Firestore Listener: Setting up snapshot listener for collection:",
      `artifacts/${appId}/public/data/pedidos`
    );

    // Fetch ALL orders (draft, sent, and deleted)
    const q = query(ordersCollectionRef); // No 'where' clause here

    // Real-time listener for orders
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        console.log(
          "Firestore Listener: Snapshot received. Number of docs:",
          snapshot.docs.length
        );
        let fetchedOrders = snapshot.docs.map((doc) => {
          const data = doc.data();
          let parsedItems = [];

          // --- START OF JSON.parse CORRECTION ---
          if (data.items) {
            if (typeof data.items === "string") {
              try {
                parsedItems = JSON.parse(data.items);
                console.log(
                  `Firestore Listener: Parsed items for doc ${doc.id}.`
                );
              } catch (e) {
                console.error(
                  `Firestore Listener: Error parsing items for doc ${doc.id}:`,
                  e,
                  `Raw data.items: "${data.items}"`
                );
                // Fallback to an empty array or handle specific malformed data
                parsedItems = [];
              }
            } else if (Array.isArray(data.items)) {
              // If items is already an array (e.g., from older saves or direct Firestore edits)
              parsedItems = data.items;
              console.log(
                `Firestore Listener: Items for doc ${doc.id} already an array.`
              );
            }
          }
          // --- END OF JSON.parse CORRECTION ---

          return {
            id: doc.id, // The Firestore document ID for this order
            header: data.header,
            items: parsedItems,
          };
        });

        // Defensive check: Ensure items are always an array, even if stored incorrectly.
        fetchedOrders = fetchedOrders.map((order) => ({
          ...order,
          items: Array.isArray(order.items)
            ? order.items
            : [order.items].filter(Boolean), // Filter Boolean removes null/undefined/empty string if it was a single non-array item
        }));

        // --- CRITICAL FIX: Sort fetched orders consistently by createdAt (OLDEST FIRST) ---
        // This ensures the newest order is always at the end of the array.
        fetchedOrders.sort((a, b) => {
          const dateA = a.header?.createdAt || 0; // Use 0 as fallback if createdAt is missing
          const dateB = b.header?.createdAt || 0;
          return dateA - dateB; // OLDEST first (ascending order of timestamp)
        });

        console.log(
          "Firestore Listener: All orders fetched from Firestore (including sent) and sorted:",
          fetchedOrders.map((o) => ({
            id: o.id,
            mailId: o.header?.mailId,
            status: o.header?.status,
            createdAt: o.header?.createdAt,
          }))
        );
        setAllOrdersFromFirestore(fetchedOrders); // Update the master list of ALL orders
        setIsLoading(false);

        // --- LOGIC FOR CREATING INITIAL DRAFT ORDER IF NONE EXIST ---
        const draftOrders = fetchedOrders.filter(
          (order) => order.header?.status === "draft"
        );

        if (
          draftOrders.length === 0 &&
          !committedSearchTerm &&
          activeOrderId === null
        ) {
          console.log(
            "Firestore Listener: No draft orders found after fetch. Creating new initial order."
          );
          const newOrderDocRef = doc(ordersCollectionRef);
          const newOrderId = newOrderDocRef.id;
          const newBlankHeader = {
            ...initialHeaderState,
            // Generate the mailId here for the initial draft
            mailId: crypto.randomUUID().substring(0, 8).toUpperCase(),
            emailSubject: generateEmailSubjectValue([], []), // Start with default subject
            status: "draft",
            createdAt: Date.now(), // Set creation timestamp
            createdBy: userId, // Assign the current user as creator
            updatedAt: Date.now(), // Set the timestamp of the first update
          };
          const newBlankItems = [
            { ...initialItemState, id: crypto.randomUUID() },
          ];
          try {
            // ADDED TRY-CATCH HERE
            await saveOrderToFirestore({
              id: newOrderId,
              header: newBlankHeader,
              items: newBlankItems,
            });
            // ONLY set activeOrderId if save was successful
            setActiveOrderId(newOrderId);
            console.log(
              "Firestore Listener: New order created and set as active:",
              newOrderId
            );
          } catch (saveError) {
            console.error(
              "Firestore Listener: ERROR: Failed to create initial draft order:",
              saveError
            );
            // Optionally, set an error state here to show user a message
            // setAppError("Failed to create initial order. Please check permissions.");
            setIsLoading(false); // Stop loading, but don't set activeOrderId
          }
        } else if (
          draftOrders.length > 0 &&
          activeOrderId === null &&
          !committedSearchTerm
        ) {
          // If there are drafts but no active order is set (e.g., initial load or after deleting the last one),
          // set the first draft as the active order (which is now the oldest draft).
          setActiveOrderId(draftOrders[0].id);
          console.log(
            "Firestore Listener: Draft orders found, setting first (oldest) draft as active:",
            draftOrders[0].id
          );
        }
      },
      (error) => {
        console.error(
          "Firestore Listener: Error fetching orders from Firestore:",
          error
        );
        setIsLoading(false);
      }
    );

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, [db, userId, isAuthReady, appId, committedSearchTerm, activeOrderId]); // activeOrderId added to dependencies to react to its changes for initial selection logic

  // Effect to filter orders based on committedSearchTerm and update displayedOrders
  useEffect(() => {
    let filtered = [];
    console.log(
      "Filter Effect: Effect filter by committedSearchTerm triggered. committedSearchTerm:",
      committedSearchTerm,
      "Current activeOrderId before update:",
      activeOrderId
    );
    console.log(
      "Filter Effect: allOrdersFromFirestore at filter time:",
      allOrdersFromFirestore.map((o) => ({
        id: o.id,
        status: o.header?.status || "N/A",
        createdAt: o.header?.createdAt,
      }))
    ); // ADDED MORE DETAIL TO LOG

    if (committedSearchTerm) {
      // If search term is present, search across all orders by Mail ID, excluding 'deleted' ones
      console.log(
        "Filter Effect: Search active. Filtering for Mail ID and not deleted."
      );
      filtered = allOrdersFromFirestore.filter((order) => {
        const mailIdMatch = (order.header?.mailId || "")
          .toLowerCase()
          .includes(committedSearchTerm.toLowerCase());
        const isNotDeleted = order.header?.status !== "deleted"; // Exclude deleted orders from search results
        console.log(
          `Filter Effect - Search Check: Order ID ${order.id}, Mail ID "${order.header?.mailId}", Status "${order.header?.status}", matches search: ${mailIdMatch}, not deleted: ${isNotDeleted}`
        );
        return mailIdMatch && isNotDeleted;
      });
    } else {
      // If no search term, display only 'draft' orders by default
      console.log(
        "Filter Effect: No search term. Filtering for 'draft' status only."
      );
      filtered = allOrdersFromFirestore.filter((order) => {
        const isDraft = order.header?.status === "draft";
        console.log(
          `Filter Effect - Draft Check: Order ID ${order.id}, Status "${order.header?.status}", isDraft: ${isDraft}`
        );
        return isDraft;
      });
      console.log(
        "Filter Effect: No search term, displaying only draft orders."
      );
    }

    // --- CRITICAL FIX: Re-sort filtered orders consistently by createdAt (OLDEST FIRST) ---
    // This ensures the newest order is always at the end of the array for UI display.
    filtered.sort((a, b) => {
      const dateA = a.header?.createdAt || 0;
      const dateB = b.header?.createdAt || 0;
      return dateA - dateB; // OLDEST first (ascending order of timestamp)
    });

    console.log(
      "Filter Effect: displayedOrders after filter and sort:",
      filtered.length,
      filtered.map((o) => ({
        id: o.id,
        createdAt: o.header?.createdAt,
        status: o.header?.status,
      }))
    );
    setDisplayedOrders(filtered);

    // --- REVISED LOGIC FOR MANAGING activeOrderId AFTER FILTERING / SORTING ---
    let newActiveOrderIdCandidate = null;

    if (committedSearchTerm) {
      // If a search is active:
      // 1. Try to keep the current activeOrderId if it's in the filtered list.
      const currentActiveInFiltered = filtered.find(
        (order) => order.id === activeOrderId
      );
      if (currentActiveInFiltered) {
        newActiveOrderIdCandidate = activeOrderId;
        console.log(
          "Filter Effect: Search active. Keeping current activeOrderId:",
          newActiveOrderIdCandidate
        );
      } else if (filtered.length > 0) {
        // 2. If current activeOrderId is not in filter, and there are results, go to the LAST result (which is now the newest).
        newActiveOrderIdCandidate = filtered[filtered.length - 1].id; // MODIFIED: Go to the last (newest) order
        console.log(
          "Filter Effect: Search active. Current active not in results. Setting to LAST (newest) filtered:",
          newActiveOrderIdCandidate
        );
      } else {
        // 3. No results found for search.
        newActiveOrderIdCandidate = null;
        console.log(
          "Filter Effect: Search active. No results found. Setting activeOrderId to null."
        );
      }
    } else {
      // If no search term (showing drafts):
      // 1. Try to keep the current activeOrderId if it's in the filtered list (drafts).
      const currentActiveInDrafts = filtered.find(
        (order) => order.id === activeOrderId
      );
      if (currentActiveInDrafts) {
        newActiveOrderIdCandidate = activeOrderId;
        console.log(
          "Filter Effect: No search. Keeping current activeOrderId (draft):",
          newActiveOrderIdCandidate
        );
      } else if (filtered.length > 0) {
        // 2. If current activeOrderId is not in drafts, default to the *last* draft (which is the newest).
        newActiveOrderIdCandidate = filtered[filtered.length - 1].id; // <-- FIX: Go to the newest draft
        console.log(
          "Filter Effect: No search. Current active not in drafts. Setting to LAST (newest) draft:",
          newActiveOrderIdCandidate
        );
      } else {
        // 3. No drafts exist.
        newActiveOrderIdCandidate = null;
        console.log(
          "Filter Effect: No search. No drafts found. Setting activeOrderId to null."
        );
      }
    }

    if (newActiveOrderIdCandidate !== activeOrderId) {
      setActiveOrderId(newActiveOrderIdCandidate);
      console.log(
        "Filter Effect: activeOrderId changed from",
        activeOrderId,
        "to",
        newActiveOrderIdCandidate
      );
    } else if (
      newActiveOrderIdCandidate &&
      newActiveOrderIdCandidate === activeOrderId
    ) {
      // If activeOrderId didn't change, but its index might have due to sorting/filtering.
      const newIndex = filtered.findIndex(
        (order) => order.id === activeOrderId
      );
      if (newIndex !== -1 && newIndex !== currentOrderIndex) {
        setCurrentOrderIndex(newIndex);
        console.log(
          "Filter Effect: currentOrderIndex updated due to order sorting (activeOrderId unchanged):",
          newIndex
        );
      }
    }
  }, [allOrdersFromFirestore, committedSearchTerm, activeOrderId]); // activeOrderId must be a dependency here

  // Effect to synchronize headerInfo and orderItems with the currently selected order from displayedOrders.
  // This effect purely reacts to activeOrderId and displayedOrders to populate the UI.
  useEffect(() => {
    console.log(
      "UI Sync Effect: Triggered. displayedOrders.length:",
      displayedOrders.length,
      "activeOrderId:",
      activeOrderId
    );

    // Case 1: An activeOrderId is set and found in the displayed orders list.
    if (activeOrderId && displayedOrders.length > 0) {
      const orderToDisplay = displayedOrders.find(
        (order) => order.id === activeOrderId
      );
      if (orderToDisplay) {
        console.log(
          "UI Sync Effect: Syncing UI with order ID:",
          orderToDisplay.id,
          "Status:",
          orderToDisplay.header.status,
          "Mail ID:",
          orderToDisplay.header.mailId
        );
        setHeaderInfo(orderToDisplay.header);
        setOrderItems(orderToDisplay.items);
        const foundIndex = displayedOrders.findIndex(
          (order) => order.id === activeOrderId
        );
        // Only update currentOrderIndex if it's different and valid
        if (foundIndex !== -1 && foundIndex !== currentOrderIndex) {
          setCurrentOrderIndex(foundIndex);
          console.log("UI Sync Effect: New currentOrderIndex:", foundIndex);
        }
      } else {
        // Case 1.1: activeOrderId is set, but the order is NOT YET in displayedOrders.
        // This can happen briefly after adding a new order and before onSnapshot updates it.
        // We DO NOT reset the UI here. We wait for displayedOrders to update.
        console.log(
          "UI Sync Effect: Active order (",
          activeOrderId,
          ") not found in displayedOrders. Waiting for data synchronization. Current UI state maintained."
        );
        // Do nothing, maintain current UI state.
      }
    }
    // Case 2: No activeOrderId is set, but there are orders in displayedOrders.
    // This happens after deleting the last active order, or on initial load if the first draft was not automatically selected.
    else if (!activeOrderId && displayedOrders.length > 0) {
      const firstDraftOrder = displayedOrders[0]; // Since displayedOrders is sorted from oldest to newest
      if (firstDraftOrder) {
        setActiveOrderId(firstDraftOrder.id);
        // setCurrentOrderIndex(0); // This will be handled by the next render cycle after setActiveOrderId updates.
        console.log(
          "UI Sync Effect: No activeOrderId, defaulting to first draft:",
          firstDraftOrder.id
        );
      } else {
        // Should not happen if displayedOrders.length > 0
        console.warn(
          "UI Sync Effect: Unexpected state: activeOrderId is null but displayedOrders is not empty and no first draft found."
        );
        setHeaderInfo({
          ...initialHeaderState,
          emailSubject: generateEmailSubjectValue([], []),
        });
        setOrderItems([initialItemState]);
        setCurrentOrderIndex(0);
      }
    }
    // Case 3: No activeOrderId is set AND no orders in displayedOrders.
    // This happens on initial load with an empty database, or after all orders are deleted.
    else if (!activeOrderId && displayedOrders.length === 0) {
      console.log(
        "UI Sync Effect: No active order and no displayed orders. Resetting UI to a blank form."
      );
      setHeaderInfo({
        ...initialHeaderState,
        emailSubject: generateEmailSubjectValue([], []),
      });
      setOrderItems([initialItemState]);
      setCurrentOrderIndex(0);
    }
    // Edge case: activeOrderId is set, but displayedOrders is empty. This is problematic.
    // Implies activeOrderId points to something that doesn't exist in the filtered view.
    // The main filtering effect should set activeOrderId to null if there are no matches.
    // If this happens, it means activeOrderId is stale and we should clear it.
    else if (activeOrderId && displayedOrders.length === 0) {
      console.warn(
        "UI Sync Effect: Stale activeOrderId detected. Clearing activeOrderId:",
        activeOrderId
      );
      setActiveOrderId(null); // Clear stale activeOrderId, this will re-trigger the effect and lead to Case 3.
    }
  }, [activeOrderId, displayedOrders]); // Dependencies for the effect to run when these variables change.

  // Handler for saving current form data to displayed orders (now also saves to Firestore)
  const saveCurrentFormDataToDisplayed = async () => {
    console.log("Save Handler: saveCurrentFormDataToDisplayed called.");
    // Made async
    // CRITICAL FIX: Ensure an active order ID exists before attempting to save
    if (!db || !userId) {
      console.warn(
        "Save Handler: Firestore not initialized or user not authenticated. Cannot save order."
      );
      return;
    }
    // If activeOrderId is null, it means we are trying to save the initial blank order before it has a Firestore ID.
    // The createNewInitialOrder function handles the initial save with a new ID.
    // This function is primarily for updates to an *existing* active order.
    if (!activeOrderId) {
      console.log(
        "Save Handler: saveCurrentFormDataToDisplayed called without activeOrderId. Skipping save for current form state."
      );
      return; // Skip saving if no active order ID, as it's likely a brand new, unsaved form.
    }

    const currentOrderData = {
      id: activeOrderId, // This is the ID that will be used for saving
      header: { ...headerInfo },
      items: orderItems.map((item) => ({ ...item })),
    };
    console.log(
      "Save Handler: Attempting to save current order data for ID:",
      currentOrderData.id,
      "Mail ID:",
      currentOrderData.header.mailId,
      "Status:",
      currentOrderData.header.status
    );
    await saveOrderToFirestore(currentOrderData); // Await the save
    console.log("Save Handler: saveCurrentFormDataToDisplayed finished.");
  };

  // Handle changes in header input fields
  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    console.log(`Header Change: Field '${name}' changed to '${value}'.`);
    setHeaderInfo((prevInfo) => ({ ...prevInfo, [name]: value })); // Update immediately with raw value
  };

  // Handle blur for header input fields (apply uppercase here)
  const handleHeaderBlur = (e) => {
    const { name, value, type } = e.target;
    if (
      type !== "date" &&
      type !== "number" &&
      name !== "emailSubject" &&
      name !== "mailId"
    ) {
      // Exclude mailId from auto-uppercase
      console.log(
        `Header Blur: Field '${name}' blurred. Value '${value}' capitalized.`
      );
      setHeaderInfo((prevInfo) => ({
        ...prevInfo,
        [name]: value.toUpperCase(),
      }));
    }
    // Removed: saveCurrentFormDataToDisplayed(); // No longer save to Firestore on blur for header fields
  };

  // Handle changes in order item table input fields (only for fields still in table)
  const handleItemChange = (itemId, e) => {
    const { name, value } = e.target;
    console.log(
      `Item Change: Item ID '${itemId}', Field '${name}' changed to '${value}'.`
    );
    setOrderItems((prevItems) => {
      const updatedItems = prevItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [name]: value, // Update immediately with raw value
            }
          : item
      );
      // Removed: saveOrderToFirestore({ id: activeOrderId, header: { ...headerInfo }, items: updatedItems }); // No longer save to Firestore immediately after item change
      return updatedItems;
    });
  };

  // Handle blur for table input fields (apply uppercase here)
  const handleItemBlur = (itemId, e) => {
    const { name, value, type } = e.target;
    console.log(
      `Item Blur: Item ID '${itemId}', Field '${name}' blurred. Original value: '${value}'.`
    );

    setOrderItems((prevItems) => {
      const updatedItems = prevItems.map((item) => {
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
            console.log(`Item Blur: PreciosFOB formatted to '${newValue}'.`);
          } else if (name === "calibre") {
            // Split by common delimiters (;, , -, space) and filter out empty strings
            const parts = value
              .split(/[,;\s-]+/)
              .filter((part) => part.trim() !== "")
              .map((part) => part.trim().toUpperCase()); // Trim and uppercase each part
            newValue = parts.join(" - "); // Join with ' - '
            console.log(`Item Blur: Calibre formatted to '${newValue}'.`);
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
            console.log(`Item Blur: Categoria formatted to '${newValue}'.`);
          }
          // 'estado' is now handled by modal, so no direct blur logic for it here
          else if (type !== "number") {
            // Apply uppercase to all other text fields except numbers
            newValue = value.toUpperCase();
            console.log(
              `Item Blur: Other text field capitalized to '${newValue}'.`
            );
          }
          return { ...item, [name]: newValue };
        }
        return item;
      });
      // Removed: saveOrderToFirestore({ id: activeOrderId, header: { ...headerInfo }, items: updatedItems }); // No longer save to Firestore immediately after item blur
      return updatedItems;
    });
  };

  // Add a new row to the order items table (duplication logic)
  const handleAddItem = (sourceItemId = null) => {
    console.log("Add Item: handleAddItem called. Source ID:", sourceItemId);
    setOrderItems((prevItems) => {
      let updatedItems;
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
          updatedItems = [
            ...prevItems.slice(0, index + 1),
            newItem,
            ...prevItems.slice(index + 1),
          ];
          console.log("Add Item: Duplicated item. New item ID:", newItem.id);
        } else {
          updatedItems = [
            ...prevItems,
            {
              // Default: add an empty row
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
          console.log("Add Item: Source item not found, adding empty row.");
        }
      } else {
        // Default: add an empty row
        updatedItems = [
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
        console.log("Add Item: Adding empty row.");
      }
      // Save to Firestore after adding an item
      saveOrderToFirestore({
        id: activeOrderId,
        header: { ...headerInfo },
        items: updatedItems,
      }); // Use activeOrderId
      console.log("Add Item: Triggering save to Firestore.");
      return updatedItems;
    });
  };

  // Delete a specific row from the order items table
  const handleDeleteItem = (idToDelete) => {
    console.log("Delete Item: handleDeleteItem called for ID:", idToDelete);
    setOrderItems((prevItems) => {
      if (prevItems.length <= 1) {
        console.log("Delete Item: Cannot delete the last row.");
        return prevItems; // Do not delete if only one item remains
      }
      const updatedItems = prevItems.filter((item) => item.id !== idToDelete);
      // Save to Firestore after deleting an item
      saveOrderToFirestore({
        id: activeOrderId,
        header: { ...headerInfo },
        items: updatedItems,
      }); // Use activeOrderId
      console.log("Delete Item: Triggering save to Firestore after deletion.");
      return updatedItems;
    });
  };

  // Toggle cancellation status of an item
  const toggleItemCancellation = (itemId) => {
    console.log("Toggle Cancellation: Called for item ID:", itemId);
    setOrderItems((prevItems) => {
      const updatedItems = prevItems.map((item) => {
        if (item.id === itemId) {
          const newIsCanceled = !item.isCanceled;
          console.log(
            `Toggle Cancellation: Item ${itemId} isCanceled changed to ${newIsCanceled}.`
          );
          return {
            ...item,
            isCanceled: newIsCanceled,
            // Set to CANCELADO if canceled, or clear if uncanceled (resetting observation)
            estado: newIsCanceled ? "CANCELADO" : "",
          };
        }
        return item;
      });
      // Save to Firestore after toggling cancellation
      saveOrderToFirestore({
        id: activeOrderId,
        header: { ...headerInfo },
        items: updatedItems,
      }); // Use activeOrderId
      console.log("Toggle Cancellation: Triggering save to Firestore.");
      return updatedItems;
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
          "Date Format: Invalid date string received by formatDateToSpanish:",
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
      console.error("Date Format: Error formatting date:", dateString, e);
      return dateString;
    }
  };

  // Function to generate the HTML for a single order block (for email and preview)
  const generateSingleOrderHtml = (
    orderHeader,
    orderItemsData,
    orderNumber
  ) => {
    // Added orderNumber parameter
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
      allObservations.length > 0 ? allObservations.join("–") : "";

    // Use values directly as they are already uppercased on blur for most fields
    const formattedNave = orderHeader.nave;
    const formattedPais = orderHeader.deNombrePais;
    const formattedFechaCarga = orderHeader.fechaCarga
      ? formatDateToSpanish(orderHeader.fechaCarga)
      : "";
    const formattedExporta = orderHeader.exporta;

    // Apply line-through to the whole order block if its status is 'deleted'
    // NOTE: This style will now only apply if a 'deleted' order somehow bypasses the filter,
    // which shouldn't happen with the new filtering logic.
    const orderBlockStyle =
      orderHeader.status === "deleted"
        ? "opacity: 0.6; text-decoration: line-through;"
        : "";

    // This will be the full HTML table for emails and desktop preview
    const itemsHtml = `
            <div class="table-wrapper-email" style="overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 10px; border-radius: 8px; border: 1px solid #ddd;">
                <table border="1" cellpadding="0" cellspacing="0" style="width: auto; min-width: 650px; border-collapse: collapse; border: none; box-sizing: border-box; text-align: left; table-layout: auto;">
                    <thead>
                        <tr style="background-color: #2563eb; color: #ffffff;">
                            <th style="padding: 3px 5px; border: 1px solid #1e40af; border-top-left-radius: 8px; text-align: center; font-size: 11px; box-sizing: border-box; white-space: nowrap;">Pallets</th>
                            <th style="padding: 3px 5px; border: 1px solid #1e40af; text-align: center; font-size: 11px; box-sizing: border-box; white-space: nowrap;">Especie</th>
                            <th style="padding: 3px 5px; border: 1px solid #1e40af; text-align: center; font-size: 11px; white-space: nowrap;">Variedad</th>
                            <th style="padding: 3px 5px; border: 1px solid #1e40af; text-align: center; font-size: 11px; white-space: nowrap;">Formato</th>
                            <th style="padding: 3px 5px; border: 1px solid #1e40af; text-align: center; font-size: 11px; white-space: nowrap;">Calibre</th>
                            <th style="padding: 3px 5px; border: 1px solid #1e40af; border-top-right-radius: 8px; text-align: center; font-size: 11px; box-sizing: border-box; white-space: nowrap;">Categoría</th>
                            <th style="padding: 3px 5px; border: 1px solid #1e40af; text-align: center; font-size: 11px; box-sizing: border-box; white-space: nowrap;">Precios FOB</th>
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
                              `<td style="padding: 3px 5px; border: 1px solid #eee; text-align: center; box-sizing: border-box; font-size: 11px; white-space: nowrap;">${item.pallets}</td>` +
                              `<td style="padding: 3px 5px; border: 1px solid #eee; text-align: center; box-sizing: border-box; font-size: 11px; white-space: nowrap;">${item.especie}</td>` +
                              `<td style="padding: 3px 5px; border: 1px solid #eee; text-align: center; font-size: 11px; white-space: nowrap;">${item.variedad}</td>` +
                              `<td style="padding: 3px 5px; border: 1px solid #eee; text-align: center; font-size: 11px; white-space: nowrap;">${item.formato}</td>` +
                              `<td style="padding: 3px 5px; border: 1px solid #eee; text-align: center; font-size: 11px; white-space: nowrap;">${item.calibre}</td>` +
                              `<td style="padding: 3px 5px; border: 1px solid #eee; text-align: center; box-sizing: border-box; font-size: 11px; white-space: nowrap;">${item.categoria}</td>` +
                              `<td style="padding: 3px 5px; border: 1px solid #eee; text-align: center; box-sizing: border-box; font-size: 11px; white-space: nowrap;">${item.preciosFOB}</td>` +
                              `</tr>`
                            );
                          })
                          .join("")}
                        <tr style="background-color: #e0e0e0;">
                            <td colSpan="6" style="padding: 6px 15px 6px 6px; text-align: right; font-weight: bold; border: 1px solid #ccc; border-bottom-left-radius: 8px; margin-top: 15px; box-sizing: border-box; font-size: 11px; white-space: nowrap;">Total de Pallets:</td>
                            <td colSpan="1" style="padding: 6px; font-weight: bold; border: 1px solid #ccc; border-bottom-right-radius: 8px; text-align: center; box-sizing: border-box; font-size: 11px; white-space: nowrap;">
                                ${singleOrderTotalPallets} Pallets
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

    // The single order container in the email.
    return `
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 8px; width: 100%; max-width: 900px; text-align: left; box-sizing: border-box; ${orderBlockStyle}">
            <div style="padding-bottom: 10px; border-bottom: 1px solid #eee; margin-bottom: 10px;">
                <p class="email-header-p" style="margin: 0; margin-bottom: 2px;"><strong>País:</strong> ${formattedPais}</p>
                <p class="email-header-p" style="margin: 0; margin-bottom: 2px;"><strong>Nave:</strong> ${formattedNave}</p>
                <p class="email-header-p" style="margin: 0; margin-bottom: 2px;"><strong>Fecha de carga:</strong> ${formattedFechaCarga}</p>
                <p class="email-header-p" style="margin: 0;"><strong>Exporta:</strong> ${formattedExporta}</p>
                <div style="clear: both;"></div> <!-- Clear float -->
            </div>
            ${itemsHtml}
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
    console.log("Clipboard: HTML content copied to clipboard.");
  };

  // Handler for "Agregar Pedido" button
  const handleAddOrder = async () => {
    console.log("Action: 'Add Order' button clicked.");
    if (!db || !userId) {
      console.warn(
        "Add Order: Firestore not initialized or user not authenticated. Cannot add new order."
      );
      return;
    }

    // 1. Save the current order's data into Firestore (this will commit any recent changes, including mailId if it was just set by finalize)
    if (activeOrderId) {
      console.log(
        "Add Order: Saving current active order before creating a new one."
      );
      await saveCurrentFormDataToDisplayed();
    }

    // Determine the Mail ID to inherit based on whether a search is active
    let mailIdToAssignForNewOrder = "";
    if (committedSearchTerm) {
      // If a search is active, the new order should inherit the committed Mail ID
      mailIdToAssignForNewOrder = committedSearchTerm;
      console.log(
        "Add Order: Inheriting Mail ID from committed search term:",
        mailIdToAssignForNewOrder
      );
    } else {
      // If no search is active, generate a new Mail ID for a truly new order,
      // or inherit from the current headerInfo if it's already a draft.
      if (headerInfo.mailId && headerInfo.status === "draft") {
        mailIdToAssignForNewOrder = headerInfo.mailId;
        console.log(
          "Add Order: Inheriting Mail ID from current draft:",
          mailIdToAssignForNewOrder
        );
      } else {
        mailIdToAssignForNewOrder = crypto
          .randomUUID()
          .substring(0, 8)
          .toUpperCase();
        console.log(
          "Add Order: Generating new Mail ID for fresh order:",
          mailIdToAssignForNewOrder
        );
      }
    }

    // MODIFIED: The collection now points to a public path
    const ordersCollectionRef = collection(
      db,
      `artifacts/${appId}/public/data/pedidos`
    );
    const newOrderDocRef = doc(ordersCollectionRef); // Get a new document reference with an auto-generated ID
    const newOrderId = newOrderDocRef.id;

    const newBlankHeader = {
      ...initialHeaderState,
      reDestinatarios: headerInfo.reDestinatarios, // Carry over supplier name
      emailSubject: generateEmailSubjectValue(
        [headerInfo.reDestinatarios],
        [],
        mailIdToAssignForNewOrder
      ), // Generate subject without mailId in string
      mailId: mailIdToAssignForNewOrder, // Assign the determined mailId
      status: "draft", // Explicitly set as draft
      createdAt: Date.now(), // Set creation timestamp for new orders
      createdBy: userId, // Assign the current user as creator
      updatedAt: Date.now(), // Set the timestamp of the first update
    };
    const newBlankItems = [{ ...initialItemState, id: crypto.randomUUID() }];

    // 3. Add the new blank order to Firestore
    console.log(
      "Add Order: Creating new order with ID:",
      newOrderId,
      "and Mail ID:",
      mailIdToAssignForNewOrder
    );
    await saveOrderToFirestore({
      id: newOrderId,
      header: newBlankHeader,
      items: newBlankItems,
    });

    // 4. IMPORTANT: Do NOT reset searchTerm or committedSearchTerm here.
    // This allows the view to remain filtered by the current Mail ID if one was set.
    // setSearchTerm(""); // Removed
    // setCommittedSearchTerm(""); // Removed

    // 5. After adding, set the new order as active to automatically navigate to it
    setActiveOrderId(newOrderId);
    console.log(
      "Add Order: New order added, setting activeOrderId to new order:",
      newOrderId
    );
  };

  // Handler for "Anterior" button
  const handlePreviousOrder = () => {
    console.log("Navigation: handlePreviousOrder called. Before navigation:", {
      currentOrderIndex,
      activeOrderId,
      displayedOrdersLength: displayedOrders.length,
    });

    if (currentOrderIndex === 0) {
      // Disabled if at the oldest (first in array)
      console.log("Navigation: Already at the first (oldest) order.");
      return;
    }

    // Save current form data before navigating
    saveCurrentFormDataToDisplayed();

    // Load the previous order (which is now the previous one in the array, as it's sorted oldest first)
    const newIndex = currentOrderIndex - 1; // Changed to -1
    if (displayedOrders[newIndex]) {
      const nextActiveId = displayedOrders[newIndex].id;
      setActiveOrderId(nextActiveId);
      console.log(
        "Navigation: Navigating to previous (older) order. New activeOrderId:",
        nextActiveId
      );
    } else {
      console.warn(
        "Navigation: Could not find previous order at index:",
        newIndex
      );
    }
  };

  // Handler for "Siguiente" button
  const handleNextOrder = () => {
    console.log("Navigation: handleNextOrder called. Before navigation:", {
      currentOrderIndex,
      activeOrderId,
      displayedOrdersLength: displayedOrders.length,
    });

    if (currentOrderIndex === displayedOrders.length - 1) {
      // Disabled if at the newest (last in array)
      console.log("Navigation: Already at the last (newest) order.");
      return;
    }

    // Save current form data before navigating
    saveCurrentFormDataToDisplayed();

    // Load the next order (which is now the next one in the array, as it's sorted oldest first)
    const newIndex = currentOrderIndex + 1; // Changed to +1
    if (displayedOrders[newIndex]) {
      const nextActiveId = displayedOrders[newIndex].id;
      setActiveOrderId(nextActiveId);
      console.log(
        "Navigation: Navigating to next (newer) order. New activeOrderId:",
        nextActiveId
      );
    } else {
      console.warn("Navigation: Could not find next order at index:", newIndex);
    }
  };

  // Handler for "Eliminar Pedido Actual" button (now performs soft delete)
  const handleDeleteCurrentOrder = async () => {
    console.log("Action: 'Delete Current Order' button clicked (soft delete).");
    try {
      // Ensure any pending edits are saved before attempting deletion
      await saveCurrentFormDataToDisplayed(); // Added this line

      if (displayedOrders.length <= 1) {
        console.log("Delete Order: Cannot delete the last order.");
        return;
      }

      console.log(
        "Delete Order: Passed initial check. displayedOrders.length:",
        displayedOrders.length,
        "currentOrderIndex:",
        currentOrderIndex
      );
      console.log(
        "Delete Order: displayedOrders content at deletion attempt:",
        displayedOrders.map((o) => ({ id: o.id, status: o.header?.status }))
      );
      console.log(
        "Delete Order: Value of currentOrderIndex:",
        currentOrderIndex
      );

      const orderIdToSoftDelete = displayedOrders[currentOrderIndex].id;
      console.log(
        "Delete Order: Attempting to soft delete order with ID:",
        orderIdToSoftDelete
      );

      // Introduce a small delay to allow current render cycle to complete
      setTimeout(async () => {
        await handleSoftDeleteOrderInFirestore(orderIdToSoftDelete); // Call soft delete function
        console.log(
          "Delete Order: Soft deletion initiated. Firestore onSnapshot will handle UI update."
        );
      }, 50); // 50ms delay
    } catch (error) {
      console.error("Error in handleDeleteCurrentOrder (soft delete):", error);
    }
  };

  // Handler for search button click
  const handleSearchClick = () => {
    console.log(
      "Action: Search button clicked. New search term:",
      searchTerm.toUpperCase()
    );
    setCommittedSearchTerm(searchTerm.toUpperCase());
  };

  // Handler for "Limpiar Búsqueda" button click
  const handleClearSearch = async () => {
    console.log("Action: 'Clear Search' button clicked. Clearing search term.");

    // 1. Save the current active order's data to ensure no unsaved changes are lost.
    // This is important if the user was editing an order and then clicks "Clear Search".
    if (activeOrderId) {
      console.log(
        "Clear Search: Saving current active order before clearing search filter."
      );
      await saveCurrentFormDataToDisplayed();
    }

    // 2. Clear the search terms. This will cause the `useEffect` that filters `allOrdersFromFirestore`
    // to revert to showing only non-deleted draft orders.
    setSearchTerm(""); // Clear the input field
    setCommittedSearchTerm(""); // Reset the committed search term to show all draft orders
    console.log(
      "Clear Search: Search filter cleared. UI will now display all active draft orders."
    );
  };

  // Function to detect if the device is mobile (more robust for preview environment)
  const isMobileDevice = () => {
    // Use window.innerWidth for more direct control in preview, as matchMedia might be influenced by iframe
    return window.innerWidth <= 767; // Assuming 767px is the breakpoint for mobile (Tailwind's 'md' is 768px)
  };

  // Function to perform the actual email sending (copy and open client)
  const performSendEmail = async () => {
    console.log("Action: 'Send Email' button clicked.");
    try {
      if (!db || !userId) {
        console.warn(
          "Send Email: Firestore not initialized or user not authenticated. Cannot send email."
        );
        return;
      }

      // CRITICAL STEP 1: Ensure the currently edited order is saved and is the most recent.
      console.log(
        "Send Email: Saving current form data before consolidating for email."
      );
      await saveCurrentFormDataToDisplayed();

      // Get the mailId from the active order's header.
      const mailGlobalId = headerInfo.mailId;
      console.log("Send Email: Mail ID of the active order:", mailGlobalId);

      if (!mailGlobalId) {
        console.error(
          "Send Email: Mail ID is missing when attempting to send email. Cannot consolidate orders."
        );
        setShowOrderActionsModal(false);
        return;
      }

      // MODIFIED: The collection now points to a public path
      const ordersCollectionRef = collection(
        db,
        `artifacts/${appId}/public/data/pedidos`
      );

      // NEW CRITICAL LOGIC: Group other relevant 'draft' orders under this mailGlobalId
      const currentProveedor = headerInfo.reDestinatarios;
      if (currentProveedor && mailGlobalId) {
        const ordersToGroupQuery = query(
          ordersCollectionRef,
          where("header.status", "==", "draft"),
          where("header.reDestinatarios", "==", currentProveedor)
        );
        console.log(
          "Send Email: Querying for draft orders to group under Mail ID:",
          mailGlobalId,
          "and Supplier:",
          currentProveedor
        );
        const ordersToGroupSnapshot = await getDocs(ordersToGroupQuery);
        const batch = writeBatch(db);

        ordersToGroupSnapshot.docs.forEach((docSnapshot) => {
          const orderData = docSnapshot.data();
          const existingMailId = orderData.header?.mailId;
          // Only update if the mailId does not exist or is different from the current mailGlobalId
          if (!existingMailId || existingMailId !== mailGlobalId) {
            const orderRef = doc(
              db,
              `artifacts/${appId}/public/data/pedidos`, // MODIFIED: Public path
              docSnapshot.id
            );
            batch.update(orderRef, { "header.mailId": mailGlobalId });
            console.log(
              `Send Email - Grouping: Order ${docSnapshot.id} updated with Mail ID: ${mailGlobalId}`
            );
          }
        });

        if (batch._mutations.length > 0) {
          await batch.commit();
          console.log(
            "Send Email - Grouping: Batch update committed for grouping orders."
          );
        } else {
          console.log(
            "Send Email - Grouping: No other draft orders to group or already grouped."
          );
        }
      } else {
        console.warn(
          "Send Email - Grouping: Skipping grouping, missing currentProveedor or mailGlobalId."
        );
      }

      // CRITICAL STEP 2: Get ALL orders from Firestore that share this mailGlobalId
      // This ensures that the freshest, consolidated data from all associated orders is obtained.
      const q = query(
        ordersCollectionRef,
        where("header.mailId", "==", mailGlobalId)
      );
      console.log(
        `Send Email: Querying Firestore for orders with header.mailId == '${mailGlobalId}' AFTER grouping update.`
      );
      const querySnapshot = await getDocs(q); // Perform a synchronous query to Firestore

      let ordersToProcess = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        header: doc.data().header,
        items: JSON.parse(doc.data().items || "[]"),
      }));

      // --- NEW FILTER: Exclude deleted orders from the email content ---
      ordersToProcess = ordersToProcess.filter(
        (order) => order.header?.status !== "deleted"
      );
      console.log(
        "Send Email: Orders after filtering out 'deleted' ones:",
        ordersToProcess.map((o) => ({ id: o.id, status: o.header?.status }))
      );

      // CRITICAL STEP 3: Ensure the most recent state of the ACTIVE order is included.
      // This handles the case of local modifications that have not yet propagated via onSnapshot.
      const activeOrderCurrentState = {
        id: activeOrderId,
        header: { ...headerInfo },
        items: orderItems.map((item) => ({ ...item })),
      };
      console.log("Send Email: Active order's local state:", {
        id: activeOrderCurrentState.id,
        mailId: activeOrderCurrentState.header?.mailId,
        status: activeOrderCurrentState.header?.status,
      });

      const existingIndexInProcess = ordersToProcess.findIndex(
        (o) => o.id === activeOrderId
      );
      if (existingIndexInProcess !== -1) {
        // If the active order is already in the list (from Firestore), replace it with the most recent local version.
        // But only if the local active order is NOT deleted.
        if (activeOrderCurrentState.header?.status !== "deleted") {
          ordersToProcess[existingIndexInProcess] = activeOrderCurrentState;
          console.log(
            "Send Email: Active order updated in consolidation list with local state (not deleted)."
          );
        } else {
          // If the active order is deleted, remove it from the list if it was there.
          ordersToProcess.splice(existingIndexInProcess, 1);
          console.log(
            "Send Email: Active order was deleted locally, removed from consolidation list."
          );
        }
      } else if (
        activeOrderCurrentState.id &&
        activeOrderCurrentState.header?.mailId === mailGlobalId &&
        activeOrderCurrentState.header?.status !== "deleted" // Only add if not deleted
      ) {
        // If the active order is NOT in the list (e.g., just created/saved), add it.
        ordersToProcess.push(activeOrderCurrentState);
        console.log(
          "Send Email: Active order added to consolidation list (not deleted)."
        );
      }

      // Sort these orders for consistent display in the email (OLDEST FIRST for numbering 1, 2, 3...)
      ordersToProcess.sort((a, b) => {
        const dateA = a.header?.createdAt || 0;
        const dateB = b.header?.createdAt || 0;
        return dateA - dateB; // OLDEST first (ascending order of timestamp)
      });
      console.log(
        "Send Email: Orders after local state merge and sort:",
        ordersToProcess.map((o) => ({
          id: o.id,
          mailId: o.header?.mailId,
          status: o.header?.status,
        }))
      );

      // If any of these orders are still in 'draft' status, mark them as 'sent' with this mailGlobalId.
      for (const order of ordersToProcess) {
        if (order.header?.status === "draft") {
          const orderDocRef = doc(
            db,
            `artifacts/${appId}/public/data/pedidos`, // MODIFIED: Public path
            order.id
          );
          await updateDoc(orderDocRef, {
            "header.mailId": mailGlobalId,
            "header.status": "sent",
            "header.lastModifiedBy": userId, // Update the user who marked it as sent
            "header.updatedAt": Date.now(), // Update the last modification timestamp
          });
          // Update the local object in ordersToProcess to reflect the change for content generation
          order.header.status = "sent";
          order.header.mailId = mailGlobalId;
          console.log(`Send Email: Order ${order.id} marked as 'sent'.`);
        }
      }

      // Check if there are orders to send/preview
      if (ordersToProcess.length === 0) {
        console.log(
          "Send Email: No orders to send after consolidation (all filtered out or none existed)."
        );
        // Show a message to the user if no orders are left after filtering
        setPreviewHtmlContent(
          '<p style="text-align: center; color: #888;">No hay pedidos activos para enviar con este ID de Mail. Todos los pedidos asociados están eliminados o no existen.</p>'
        );
        setIsShowingPreview(true); // Show this message in the preview area
        setEmailActionTriggered(false);
        return;
      }

      // Generate email content based on consolidated orders
      let innerEmailContentHtml = "";
      const allProveedores = new Set();
      const allEspecies = new Set();

      ordersToProcess.forEach((order, index) => {
        innerEmailContentHtml += `
            <h3 style="font-size: 18px; color: #2563eb; margin-top: 40px; margin-bottom: 15px; text-align: left;">Pedido #${
              index + 1 // MODIFIED: So the oldest is number 1
            }</h3>
            ${generateSingleOrderHtml(order.header, order.items, index + 1)}
        `;

        if (order.header.reDestinatarios)
          allProveedores.add(order.header.reDestinatarios);
        order.items.forEach((item) => {
          if (item.especie) allEspecies.add(item.especie);
        });
      });

      // Generate consolidated subject (without Mail ID in the subject)
      const consolidatedSubject = generateEmailSubjectValue(
        Array.from(allProveedores),
        Array.from(allEspecies),
        "" // Do not pass mailGlobalId here so it's not included in the subject.
      );
      console.log(
        "Send Email: Consolidated Email Subject (without Mail ID):",
        consolidatedSubject
      );

      // Wrap all email body content in a div. Add DOCTYPE and html/head/body structure.
      const fullEmailBodyHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Detalle de Pedido</title>
            <style>
              /* Global styles for email */
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f8f8f8; }
              .container { padding: 0px; box-sizing: border-box; text-align: left; }
              /* Responsive styles for email */
              @media only screen and (max-width: 767px) {
                  .email-header-p {
                      font-size: 12px !important;
                      margin-bottom: 1px !important;
                  }
                  .email-header-p:last-of-type {
                      margin-bottom: 4px !important;
                  }
                  h3 {
                      font-size: 16px !important;
                      margin-top: 20px !important;
                      margin-bottom: 10px !important;
                  }
                  /* Ensure bold for header labels in mobile preview */
                  .email-header-p strong {
                      font-weight: bold !important;
                  }
                  table th, table td {
                      font-size: 8px !important; /* Further reduced font size for mobile */
                      padding: 2px 2px !important; /* Further reduced padding for mobile */
                      white-space: nowrap; /* Force content onto one line */
                  }
                  table {
                      width: auto !important; /* Allow table to auto-size based on content/min-width */
                      min-width: 650px !important; /* Increased minimum width for content, allowing overflow-x to work */
                      table-layout: auto; /* Allow column widths to adjust to content */
                  }
                  /* Ensure the wrapper div for the table handles horizontal scrolling */
                  .table-wrapper-email {
                      overflow-x: auto !important;
                      -webkit-overflow-scrolling: touch !important;
                  }
              }
              /* General table styles */
              table {
                  max-width: 100%;
                  width: auto;
                  border-collapse: collapse;
                  table-layout: auto;
              }
              table th, table td {
                  border: 1px solid #eee;
                  padding: 3px 5px;
                  text-align: center;
                  vertical-align: top; /* Align content to top for multi-line cells */
                  white-space: nowrap; /* Force content onto one line */
              }
              table thead th {
                  background-color: #2563eb;
                  color: #ffffff;
              }
            </style>
        </head>
        <body>
            <div class="container">
                <div style="text-align: right; margin-bottom: 10px; font-weight: bold; font-size: 14px; color: #ef4444;">Mail ID: ${mailGlobalId}</div>
                ${innerEmailContentHtml}
            </div>
        </body>
        </html>
      `;

      copyFormattedContentToClipboard(fullEmailBodyHtml);
      console.log("Send Email: Email content copied to clipboard.");

      const recipient = "";
      const emailBodyTextForMailto =
        "El contenido del pedido ha sido copiado a tu portapapeles. Por favor, abre tu aplicación de correo y pega el contenido manualmente en el cuerpo del mensaje.";

      // Attempt to open the mail client
      if (isMobileDevice()) {
        // Use isMobileDevice() again to ensure mobile client is targeted
        const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(
          consolidatedSubject
        )}&body=${encodeURIComponent(emailBodyTextForMailto)}`;
        window.location.href = mailtoLink;
        console.log("Send Email: Attempting to open mailto link for mobile.");
      } else {
        window.open(
          `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${recipient}&su=${encodeURIComponent(
            consolidatedSubject
          )}&body=`,
          "_blank"
        );
        console.log(
          "Send Email: Attempting to open Gmail compose window for desktop."
        );
      }

      // After successfully sending the email and closing the modal
      setShowOrderActionsModal(false); // Close the modal first

      // Reset search term and commit the reset to clear filter
      setSearchTerm("");
      setCommittedSearchTerm("");

      // Reset other states for visual feedback
      setEmailActionTriggered(false);
      setIsShowingPreview(false);
      setPreviewHtmlContent("");
      console.log("Send Email: UI states reset after email send.");
    } catch (error) {
      console.error("Send Email: Failed to send email:", error);
      // You can add a user-visible error message here if desired.
    }
  };

  // Function to handle the "Previsualizar Pedido" action (called from within modal)
  const handlePreviewOrder = async () => {
    // Made async to use await
    console.log("Action: 'Preview Order' button clicked.");
    // CRITICAL STEP 1: Ensure the currently edited order is saved and is the most recent.
    console.log(
      "Preview Order: Saving current form data before consolidating for preview."
    );
    await saveCurrentFormDataToDisplayed();

    // Get the mailId from the active order's header.
    const previewGlobalId = headerInfo.mailId; // No fallback here, handle it as an error if missing
    console.log(
      "Preview Order: Mail ID of the active order for preview:",
      previewGlobalId
    );

    if (!previewGlobalId) {
      console.warn(
        "Preview Order: Cannot preview: No Mail ID associated with the current order."
      );
      setPreviewHtmlContent(
        '<p style="text-align: center; color: #888;">No hay pedidos para previsualizar sin un ID de Mail asociado.</p>'
      );
      setIsShowingPreview(true);
      return;
    }

    // MODIFIED: The collection now points to a public path
    const ordersCollectionRef = collection(
      db,
      `artifacts/${appId}/public/data/pedidos`
    );

    // NEW CRITICAL LOGIC: Group other relevant 'draft' orders under this previewGlobalId
    const currentProveedor = headerInfo.reDestinatarios;
    if (currentProveedor && previewGlobalId) {
      const ordersToGroupQuery = query(
        ordersCollectionRef,
        where("header.status", "==", "draft"),
        where("header.reDestinatarios", "==", currentProveedor)
      );
      console.log(
        "Preview Order: Querying for draft orders to group under Mail ID:",
        previewGlobalId,
        "and Supplier:",
        currentProveedor
      );
      const ordersToGroupSnapshot = await getDocs(ordersToGroupQuery);
      const batch = writeBatch(db);

      ordersToGroupSnapshot.docs.forEach((docSnapshot) => {
        const orderData = docSnapshot.data();
        const existingMailId = orderData.header?.mailId;
        // Only update if the mailId does not exist or is different from the current previewGlobalId
        if (!existingMailId || existingMailId !== previewGlobalId) {
          const orderRef = doc(
            db,
            `artifacts/${appId}/public/data/pedidos`, // MODIFIED: Public path
            docSnapshot.id
          );
          batch.update(orderRef, { "header.mailId": previewGlobalId });
          console.log(
            `Preview Order - Grouping: Order ${docSnapshot.id} updated with Mail ID: ${previewGlobalId}`
          );
        }
      });

      if (batch._mutations.length > 0) {
        await batch.commit();
        console.log(
          "Preview Order - Grouping: Batch update committed for grouping orders (preview)."
        );
      } else {
        console.log(
          "Preview Order - Grouping: No other draft orders to group for preview or already grouped."
        );
      }
    } else {
      console.warn(
        "Preview Order - Grouping: Skipping grouping for preview, missing currentProveedor or previewGlobalId."
      );
    }

    // CRITICAL STEP 2: Get ALL orders from Firestore that share this previewGlobalId
    // This ensures that the freshest, consolidated data from all associated orders is obtained.
    const q = query(
      ordersCollectionRef,
      where("header.mailId", "==", previewGlobalId)
    );
    console.log(
      `Preview Order: Querying Firestore for orders with header.mailId == '${previewGlobalId}' AFTER grouping update.`
    );
    const querySnapshot = await getDocs(q); // Perform a synchronous query to Firestore

    let ordersForPreview = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      header: doc.data().header,
      items: JSON.parse(doc.data().items || "[]"),
    }));

    // --- NEW FILTER: Exclude deleted orders from the preview content ---
    ordersForPreview = ordersForPreview.filter(
      (order) => order.header?.status !== "deleted"
    );
    console.log(
      "Preview Order: Orders after filtering out 'deleted' ones:",
      ordersForPreview.map((o) => ({ id: o.id, status: o.header?.status }))
    );

    // CRITICAL STEP 3: Ensure the most recent state of the ACTIVE order is included.
    // This handles the case of local modifications that have not yet propagated via onSnapshot.
    const activeOrderCurrentState = {
      id: activeOrderId,
      header: { ...headerInfo },
      items: orderItems.map((item) => ({ ...item })),
    };
    console.log("Preview Order: Active order's local state:", {
      id: activeOrderCurrentState.id,
      mailId: activeOrderCurrentState.header?.mailId,
      status: activeOrderCurrentState.header?.status,
    });

    const existingIndex = ordersForPreview.findIndex(
      (o) => o.id === activeOrderId
    );
    if (existingIndex !== -1) {
      // If the active order is already in the list (from Firestore), replace it with the most recent local version.
      // But only if the local active order is NOT deleted.
      if (activeOrderCurrentState.header?.status !== "deleted") {
        ordersForPreview[existingIndex] = activeOrderCurrentState;
        console.log(
          "Preview Order: Active order updated in consolidation list with local state (not deleted)."
        );
      } else {
        // If the active order is deleted, remove it from the list if it was there.
        ordersForPreview.splice(existingIndex, 1);
        console.log(
          "Preview Order: Active order was deleted locally, removed from consolidation list."
        );
      }
    } else if (
      activeOrderCurrentState.id &&
      activeOrderCurrentState.header?.mailId === previewGlobalId &&
      activeOrderCurrentState.header?.status !== "deleted" // Only add if not deleted
    ) {
      // If the active order is NOT in the list (e.g., just created/saved), add it.
      ordersForPreview.push(activeOrderCurrentState);
      console.log(
        "Preview Order: Active order added to consolidation list (not deleted)."
      );
    }

    // Sort these orders for consistent display in the preview (OLDEST FIRST for numbering 1, 2, 3...)
    ordersForPreview.sort((a, b) => {
      const dateA = a.header?.createdAt || 0;
      const dateB = b.header?.createdAt || 0;
      return dateA - dateB; // OLDEST first (ascending order of timestamp)
    });
    console.log(
      "Preview Order: Orders after local state merge and sort:",
      ordersForPreview.map((o) => ({
        id: o.id,
        mailId: o.header?.mailId,
        status: o.header?.status,
      }))
    );

    if (ordersForPreview.length === 0) {
      setPreviewHtmlContent(
        '<p style="text-align: center; color: #888;">No hay pedidos activos para previsualizar con este ID de Mail. Todos los pedidos asociados están eliminados o no existen.</p>'
      );
      console.log("Preview Order: No orders to preview generated.");
    } else {
      let innerPreviewHtml = "";
      ordersForPreview.forEach((order, index) => {
        innerPreviewHtml += `
          <h3 style="font-size: 18px; color: #2563eb; margin-top: 20px; margin-bottom: 10px; text-align: left;">Pedido #${
            index + 1 // MODIFIED: So the oldest is number 1
          }</h3>
          ${generateSingleOrderHtml(order.header, order.items, index + 1)}
        `;
      });

      // Wrap all preview content in a div. Add DOCTYPE and html/head/body structure.
      const finalPreviewHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Previsualización de Pedido</title>
            <style>
              /* Global styles for preview */
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f8f8f8; }
              .container { padding: 0px; box-sizing: border-box; text-align: left; }
              /* Responsive styles for preview */
              @media only screen and (max-width: 767px) {
                  .email-header-p {
                      font-size: 12px !important;
                      margin-bottom: 1px !important;
                  }
                  .email-header-p:last-of-type {
                      margin-bottom: 4px !important;
                  }
                  h3 {
                      font-size: 16px !important;
                      margin-top: 20px !important;
                      margin-bottom: 10px !important;
                  }
                  /* Ensure bold for header labels in mobile preview */
                  .email-header-p strong {
                      font-weight: bold !important;
                  }
                  table th, table td {
                      font-size: 8px !important; /* Further reduced font size for mobile */
                      padding: 2px 2px !important; /* Further reduced padding for mobile */
                      white-space: nowrap; /* Force content onto one line */
                  }
                  table {
                      width: auto !important; /* Allow table to auto-size based on content/min-width */
                      min-width: 650px !important; /* Increased minimum width for content, allowing overflow-x to work */
                      table-layout: auto; /* Allow column widths to adjust to content */
                  }
                  .table-wrapper-email {
                      overflow-x: auto !important;
                      -webkit-overflow-scrolling: touch !important;
                  }
              }
              /* General table styles */
              table {
                  max-width: 100%;
                  width: auto;
                  border-collapse: collapse;
                  table-layout: auto;
              }
              table th, table td {
                  border: 1px solid #eee;
                  padding: 3px 5px;
                  text-align: center;
                  vertical-align: top;
                  white-space: nowrap; /* Force content onto one line */
              }
              table thead th {
                  background-color: #2563eb;
                  color: #ffffff;
              }
            </style>
        </head>
        <body>
            <div class="container">
                <div style="text-align: right; margin-bottom: 10px; font-weight: bold; font-size: 14px; color: #ef4444;">Mail ID: ${previewGlobalId}</div>
                ${innerPreviewHtml}
            </div>
        </body>
        </html>
      `;
      setPreviewHtmlContent(finalPreviewHtml);
      console.log("Preview Order: Preview content generated.");
    }
    setIsShowingPreview(true); // Show the preview content within the current modal
  };

  // Function to handle the "Finalizar Pedido" button (new main button)
  const handleFinalizeOrder = async () => {
    console.log("Action: 'Finalize Order' button clicked.");

    // If the current order does not have a Mail ID, generate one and update local state
    let mailIdToAssign = headerInfo.mailId;
    if (!headerInfo.mailId) {
      mailIdToAssign = crypto.randomUUID().substring(0, 8).toUpperCase();
      console.log("Finalize Order: Generating new Mail ID:", mailIdToAssign);
      // Update local state IMMEDIATELY for the subsequent save
      setHeaderInfo((prev) => ({ ...prev, mailId: mailIdToAssign }));
    } else {
      console.log(
        "Finalize Order: Order already has Mail ID. Not generating new one:",
        headerInfo.mailId
      );
    }

    // 1. Save current form data before opening the modal for final actions
    // This `saveCurrentFormDataToDisplayed` will now pick up the potentially new `mailIdToAssign`
    console.log(
      "Finalize Order: Saving current form data before modal opens (with potentially new Mail ID)."
    );
    await saveCurrentFormDataToDisplayed(); // This will save the new mailId if it was just generated and set.

    // 3. Open the modal
    setShowOrderActionsModal(true);
    setEmailActionTriggered(false); // Reset email action triggered state
    setIsShowingPreview(false); // Ensure preview is hidden when modal first opens
    setPreviewHtmlContent(""); // Clear any previous preview content
    console.log("Finalize Order: Modal opened with Mail ID:", mailIdToAssign); // Use mailIdToAssign for log
  };

  // Function to open the observation modal
  const handleOpenObservationModal = (itemId) => {
    console.log("Observation Modal: Opening for item ID:", itemId);
    const itemToEdit = orderItems.find((item) => item.id === itemId);
    if (itemToEdit) {
      setCurrentEditingItemData(itemToEdit);
      setModalObservationText(itemToEdit.estado); // Initialize modal's input with current observation
      setShowObservationModal(true);
      console.log("Observation Modal: Data loaded for item:", itemId);
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
      console.log("Observation Modal: Textarea focused.");
    }
  }, [showObservationModal]);

  // Function to save the observation from modal
  const handleSaveObservation = () => {
    console.log("Observation Modal: Saving observation.");
    if (currentEditingItemData) {
      // Capitalize only the first letter, and make the rest lowercase for consistency
      const formattedObservation = modalObservationText
        ? modalObservationText.charAt(0).toUpperCase() +
          modalObservationText.slice(1).toLowerCase()
        : "";
      console.log(
        "Observation Modal: Formatted observation:",
        formattedObservation
      );

      const updatedItems = orderItems.map((item) =>
        item.id === currentEditingItemData.id
          ? { ...item, estado: formattedObservation }
          : item
      );
      setOrderItems(updatedItems);
      // Save to Firestore after updating observation
      saveOrderToFirestore({
        id: activeOrderId,
        header: { ...headerInfo },
        items: updatedItems,
      }); // Use activeOrderId
      console.log(
        "Observation Modal: Observation saved for item:",
        currentEditingItemData.id,
        "Triggering Firestore save."
      );
    }
    setShowObservationModal(false);
    setCurrentEditingItemData(null);
    setModalObservationText("");
    console.log("Observation Modal: Closed.");
  };

  // Function to close the observation modal (cancel)
  const handleCloseObservationModal = () => {
    console.log("Observation Modal: Closing (cancel).");
    setShowObservationModal(false);
    setCurrentEditingItemData(null);
    setModalObservationText("");
    console.log("Observation Modal: Closed.");
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
        console.log("Keyboard Nav: Arrow key pressed:", e.key);

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
                console.log(
                  "Keyboard Nav: Moved from header to first table row."
                );
              }
            }
          } else if (e.key === "ArrowUp") {
            nextIndex =
              (headerIndex - 1 + headerInputOrder.length) %
              headerInputOrder.length;
            if (headerInputRefs.current[headerInputOrder[nextIndex]]) {
              headerInputRefs.current[headerInputOrder[nextIndex]].focus();
              isHandled = true;
              console.log("Keyboard Nav: Moved within header (ArrowUp).");
            }
          }
          if (
            !isHandled &&
            headerInputRefs.current[headerInputOrder[nextIndex]]
          ) {
            headerInputRefs.current[headerInputOrder[nextIndex]].focus();
            isHandled = true;
            console.log("Keyboard Nav: Moved within header (ArrowLeft/Right).");
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
              console.log(
                `Keyboard Nav: Moving to table cell [${targetRowIndex}, ${targetColName}].`
              );
            }
          } else if (targetRowIndex < 0) {
            const lastHeaderInputName =
              headerInputOrder[headerInputOrder.length - 1];
            nextElementToFocus = headerInputRefs.current[lastHeaderInputName];
            console.log(
              "Keyboard Nav: Moving from table to last header input."
            );
          } else if (targetRowIndex >= orderItems.length) {
            // This case handles trying to move down from the last row.
            // It should stay on the last row's current column, or add a new row if at the very end.
            // Current behavior: Stays on last row.
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
              console.log(
                "Keyboard Nav: Staying on last table row (ArrowDown)."
              );
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

  // Render loading indicator if data is still loading
  if (isLoading) {
    console.log("Render: App is loading...");
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-blue-600 text-lg font-semibold">
          Cargando pedidos...
        </div>
      </div>
    );
  }

  // Determine if the current active order is deleted
  const currentOrderIsDeleted = headerInfo.status === "deleted";

  console.log("Render: App is ready. Current activeOrderId:", activeOrderId);
  console.log("Render: Current headerInfo:", headerInfo);
  console.log("Render: Current orderItems:", orderItems);
  console.log("Render: Current order is deleted:", currentOrderIsDeleted);

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

        {/* Display userId for debugging/reference */}
        {userId && (
          <div className="absolute top-4 left-4 text-xs text-gray-500">
            User ID: {userId}
          </div>
        )}

        <div className="border-b pb-4 mb-4 pt-16 sm:pt-0">
          <h1 className="text-xl sm:text-2xl font-bold text-center text-gray-800 mb-4">
            Pedidos Comercial Frutam
          </h1>
          {/* Search Input and Buttons */}
          <div className="flex items-end gap-2 mb-4">
            <div className="flex-grow">
              <label
                htmlFor="searchTerm"
                className="block text-sm font-medium text-gray-700"
              >
                Buscar por Mail ID:
              </label>
              <input
                type="text"
                id="searchTerm"
                name="searchTerm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ingrese el Mail ID (ej. 5B7D7692)"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 bg-gray-50 border"
              />
            </div>
            <button
              onClick={handleSearchClick}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out mt-auto"
            >
              Buscar
            </button>
            <button
              onClick={handleClearSearch}
              className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md shadow-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition duration-150 ease-in-out mt-auto"
            >
              Limpiar Búsqueda
            </button>
          </div>
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
                readOnly={currentOrderIsDeleted} // Disable if deleted
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
                ref={(el) => (headerInputRefs.current.deDestinatarios = el)}
                readOnly={currentOrderIsDeleted} // Disable if deleted
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
                readOnly={currentOrderIsDeleted} // Disable if deleted
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
                readOnly={currentOrderIsDeleted} // Disable if deleted
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
                readOnly={currentOrderIsDeleted} // Disable if deleted
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
                readOnly={true} // Always read-only as it's auto-generated
              />
            </div>
            {/* Mail ID field removed from UI as per request */}
          </div>
        </div>

        {/* Navigation Buttons and Order Indicator - ABOVE the table */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-4 mb-6">
          <div className="flex items-center justify-center w-full sm:w-auto">
            {/* Previous Button - icon then text */}
            <button
              onClick={handlePreviousOrder}
              disabled={currentOrderIndex === 0} // Disabled if at the oldest (first in array)
              className="flex items-center justify-center px-3 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              title="Ir al pedido anterior (más antiguo)"
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
              {`Pedido ${currentOrderIndex + 1} de ${displayedOrders.length}`}
              {currentOrderIsDeleted && (
                <span className="text-red-500 ml-2">(Eliminado)</span>
              )}
            </span>

            {/* Next Button - text then icon */}
            <button
              onClick={handleNextOrder}
              disabled={currentOrderIndex === displayedOrders.length - 1} // Disabled if at the newest (last in array)
              className="flex items-center justify-center px-3 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              title="Ir al siguiente pedido (más reciente)"
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

        {displayedOrders.length === 0 && committedSearchTerm ? (
          <div className="text-center text-gray-600 text-lg my-8">
            No se encontraron pedidos con el ID:{" "}
            <span className="font-semibold">{committedSearchTerm}</span>.
          </div>
        ) : (
          <>
            {" "}
            {/* Use a React Fragment to group the table and mobile view */}
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
                      } ${
                        item.isCanceled || currentOrderIsDeleted
                          ? "text-red-500"
                          : ""
                      }`}
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
                          readOnly={item.isCanceled || currentOrderIsDeleted} // Disable if canceled or order is deleted
                          isCanceledProp={
                            item.isCanceled || currentOrderIsDeleted
                          }
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
                          readOnly={item.isCanceled || currentOrderIsDeleted} // Disable if canceled or order is deleted
                          isCanceledProp={
                            item.isCanceled || currentOrderIsDeleted
                          }
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
                          readOnly={item.isCanceled || currentOrderIsDeleted} // Disable if canceled or order is deleted
                          isCanceledProp={
                            item.isCanceled || currentOrderIsDeleted
                          }
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
                          readOnly={item.isCanceled || currentOrderIsDeleted} // Disable if canceled or order is deleted
                          isCanceledProp={
                            item.isCanceled || currentOrderIsDeleted
                          }
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
                          readOnly={item.isCanceled || currentOrderIsDeleted} // Disable if canceled or order is deleted
                          isCanceledProp={
                            item.isCanceled || currentOrderIsDeleted
                          }
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
                          readOnly={item.isCanceled || currentOrderIsDeleted} // Disable if canceled or order is deleted
                          isCanceledProp={
                            item.isCanceled || currentOrderIsDeleted
                          }
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
                          readOnly={item.isCanceled || currentOrderIsDeleted} // Disable if canceled or order is deleted
                          isCanceledProp={
                            item.isCanceled || currentOrderIsDeleted
                          }
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
                          disabled={currentOrderIsDeleted} // Disable if order is deleted
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleAddItem(item.id)}
                          className="text-green-600 hover:text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 p-1 rounded-md"
                          title="Duplicar fila"
                          disabled={currentOrderIsDeleted} // Disable if order is deleted
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
                          disabled={currentOrderIsDeleted} // Disable if order is deleted
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
                            orderItems.length <= 1 || currentOrderIsDeleted
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                          title={
                            orderItems.length <= 1
                              ? "No se puede eliminar la última fila"
                              : "Eliminar fila"
                          }
                          disabled={
                            orderItems.length <= 1 || currentOrderIsDeleted
                          } // Disable if only one item or order is deleted
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
            </div>
            {/* Mobile View - Cards for each row (hidden on screens larger than md) */}
            <div className="md:hidden space-y-4 p-2">
              {orderItems.map((item, index) => (
                <div /* This is the single parent div for each item in the mobile view */
                  key={item.id}
                  className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2 ${
                    item.isCanceled || currentOrderIsDeleted
                      ? "line-through text-red-500 opacity-70"
                      : ""
                  }`}
                >
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-xs font-semibold text-blue-600">
                      Artículo #{index + 1}
                    </span>
                    <div className="flex space-x-2">
                      {/* Updated Observation Button for mobile */}
                      <button
                        onClick={() => handleOpenObservationModal(item.id)}
                        className="text-blue-600 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 p-1 rounded-md"
                        title="Editar Observación"
                        disabled={currentOrderIsDeleted} // Disable if order is deleted
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
                        disabled={currentOrderIsDeleted} // Disable if order is deleted
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
                        disabled={currentOrderIsDeleted} // Disable if order is deleted
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
                            />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className={`ml-1 text-red-600 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 p-1 rounded-md ${
                          orderItems.length <= 1 || currentOrderIsDeleted
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                        title={
                          orderItems.length <= 1
                            ? "No se puede eliminar la última fila"
                            : "Eliminar fila"
                        }
                        disabled={
                          orderItems.length <= 1 || currentOrderIsDeleted
                        } // Disable if only one item or order is deleted
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
                      readOnly={item.isCanceled || currentOrderIsDeleted}
                      isCanceledProp={item.isCanceled || currentOrderIsDeleted}
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
                      readOnly={item.isCanceled || currentOrderIsDeleted}
                      isCanceledProp={item.isCanceled || currentOrderIsDeleted}
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
                      readOnly={item.isCanceled || currentOrderIsDeleted}
                      isCanceledProp={item.isCanceled || currentOrderIsDeleted}
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
                      readOnly={item.isCanceled || currentOrderIsDeleted}
                      isCanceledProp={item.isCanceled || currentOrderIsDeleted}
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
                      readOnly={item.isCanceled || currentOrderIsDeleted}
                      isCanceledProp={item.isCanceled || currentOrderIsDeleted}
                    />
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-gray-500 w-1/2">
                      Categoría:
                    </span>
                    <TableInput
                      name="categoria"
                      value={item.categoria}
                      onChange={(e) => handleItemChange(e.id, e)}
                      onBlur={(e) => handleItemBlur(e.id, e)}
                      placeholder="PRE:XFY"
                      readOnly={item.isCanceled || currentOrderIsDeleted}
                      isCanceledProp={item.isCanceled || currentOrderIsDeleted}
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
                      readOnly={item.isCanceled || currentOrderIsDeleted}
                      isCanceledProp={item.isCanceled || currentOrderIsDeleted}
                    />
                  </div>
                </div> /* Closing the single parent div for each item */
              ))}
              {/* Mobile Total Pallets outside of individual item cards */}
              <div className="bg-blue-100 border border-blue-200 rounded-lg py-2 px-3 shadow-sm text-center font-bold text-base text-blue-800 mt-4">
                Total de Pallets: {currentOrderTotalPallets} Pallets
              </div>
            </div>
          </>
        )}

        {/* Combined Action Buttons: Agregar Pedido & Finalizar Pedido */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
          <button
            onClick={handleAddOrder}
            className="flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-150 ease-in-out transform hover:scale-105 w-full sm:w-auto"
            title="Crear un nuevo pedido en blanco"
            disabled={currentOrderIsDeleted} // Disable if order is deleted
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
              />
            </svg>
            Agregar Pedido
          </button>

          <button
            onClick={handleDeleteCurrentOrder}
            disabled={displayedOrders.length <= 1 || currentOrderIsDeleted} // Disable if only one order remains OR order is already deleted
            className={`flex items-center justify-center px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-150 ease-in-out transform hover:scale-105 w-full sm:w-auto ${
              displayedOrders.length <= 1 || currentOrderIsDeleted
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
            title="Eliminar el pedido actual"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm-1 4a1 1 0 002 0v-4a1 1 0 00-2 0v4z"
              />
            </svg>
            Eliminar Pedido
          </button>
          <button
            onClick={handleFinalizeOrder}
            className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out transform hover:scale-105 w-full sm:w-auto"
            title="Finalizar el pedido y ver opciones de envío"
            disabled={currentOrderIsDeleted} // Disable if order is deleted
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
              />
            </svg>
            Finalizar Pedido
          </button>
        </div>

        {/* Unified Order Actions Modal */}
        {showOrderActionsModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
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
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
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
        {/* Datalist for "Variedad" field (apple varieties) */}
        <datalist id="apple-varieties">
          <option value="GALA" />
          <option value="GRANNY" />
          <option value="FUJI" />
          <option value="PINK LADY" />
          <option value="ROJA" />
          <option value="CRIPPS PINK" />
        </datalist>
      </div>{" "}
      {/* This closes the main max-w-4xl div */}
    </div>
  );
};

export default App;
