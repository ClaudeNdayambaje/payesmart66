import { useState, useEffect, useCallback, createContext } from 'react';
import { onEvent } from './services/eventService';
import { useSettingsSync } from './hooks/useSettingsSync'; // Import du hook de synchronisation des paramètres
import './styles/themes.css';
import './styles/hide-scrollbar.css'; // Import du CSS pour masquer les barres de défilement
import Sidebar from './components/Sidebar';
import ProductGrid from './components/ProductGrid';
import Cart from './components/Cart';
import ThemeObserver from './components/ThemeObserver';
import SimpleBarcodeReader from './components/SimpleBarcodeReader';
import QRCodeGenerator from './components/QRCodeGenerator';
import SalesHistoryFirebase from './components/SalesHistoryFirebase';
import PromotionsManager from './components/PromotionsManager';
import StockManager from './components/StockManager';
import StockAlert from './components/StockAlert';
import StockMovementModal from './components/StockMovementModal';
import StockHistoryModal from './components/StockHistoryModal';
import SupplierOrders from './components/SupplierOrders';
import SupplierOrderModal from './components/SupplierOrderModal';
import PaymentModal from './components/PaymentModal';
import Receipt from './components/Receipt';
import LoyaltyCardModal from './components/LoyaltyCardModal';
import LoyaltyManager from './components/LoyaltyManager';
import Settings from './components/Settings'; // Importer le composant Settings modifié
import EmployeeLogin from './components/EmployeeLogin';
import EmployeeManagerFirebase from './components/EmployeeManagerFirebase';
import { canAccessView, canPerformAction, canViewModuleItem } from './services/permissionService';
import { usePermissions } from './hooks/usePermissions';
import { addSale, initSalesListener } from './services/saleService';
import { autoCheckSubscriptionStatus } from './services/subscriptionVerificationService';
import { Tag, AlertTriangle, ChevronDown, ChevronUp, Trash2, Menu } from 'lucide-react';
import { adjustStock, getStockMovements as fetchStockMovements } from './services/stockService';
import { getProducts, addProduct, deleteProduct, updateProduct } from './services/productService';
import { getCategories, addCategory, updateCategory, deleteCategory, removeDuplicateCategories } from './services/categoryService';
import { getSettings, AppSettings, defaultSettings } from './services/settingsService';
import Reports from './components/Reports';
// import SettingsFirebase from './components/SettingsFirebase'; // Commenté pour utiliser Settings à la place
import { Search, ShoppingCart } from 'lucide-react';
import { Product, CartItem, Sale, Receipt as ReceiptType, Promotion, LoyaltyCard, Employee, StockMovement, StockAdjustment, LoyaltyTier } from './types';
import { auth } from './firebase';
import { findProductByBarcode } from './services/barcodeService';
import { normalizePromotion } from './services/promotionService';

// Activer le mode débogage pour voir les logs détaillés des permissions
const DEBUG_PERMISSIONS = true;

// Création d'un contexte pour partager l'employé actuel dans l'application
export const AppContext = createContext<{
  currentEmployee: Employee | null;
  setCurrentEmployee: React.Dispatch<React.SetStateAction<Employee | null>>;
}>({
  currentEmployee: null,
  setCurrentEmployee: () => {},
});

function App() {
  // Utiliser le hook de synchronisation des paramètres pour gérer les changements d'utilisateur
  useSettingsSync();
  
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  
  // Initialiser l'écouteur de ventes en temps réel
  useEffect(() => {
    // Fonction de rappel pour mettre à jour les ventes
    const handleSalesUpdate = () => {
      // Nous n'utilisons pas directement les ventes dans ce composant pour le moment
    };
    
    // Initialiser l'écouteur
    const unsubscribe = initSalesListener(handleSalesUpdate);
    
    // Nettoyage lors du démontage du composant
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Écouter les événements de mise à jour des stocks
  useEffect(() => {
    // Fonction pour gérer les mises à jour de stock
    const handleStockUpdate = async (payload: any) => {
      console.log('Mise à jour de stock détectée dans App.tsx:', payload);
      
      // Si la mise à jour provient d'une commande fournisseur et contient une instruction de navigation
      if (payload && payload.source === 'supplierOrderReceived' && payload.navigateTo === 'pos') {
        console.log('Navigation automatique vers la page Caisse après réception de commande fournisseur');
        
        try {
          // D'abord recharger les produits pour afficher les stocks mis à jour
          console.log('Rechargement des produits avant navigation...');
          const updatedProducts = await getProducts();
          setProducts(updatedProducts);
          console.log('Produits rechargés avec succès, nombre de produits:', updatedProducts.length);
          
          // Ensuite changer la vue vers la page Caisse après un court délai
          setTimeout(() => {
            setActiveView('pos');
            console.log('Vue changée vers la page Caisse');
          }, 300);
        } catch (error) {
          console.error('Erreur lors du rechargement des produits:', error);
          // En cas d'erreur, on navigue quand même vers la page Caisse
          setActiveView('pos');
        }
      }
    };
    
    // S'abonner à l'événement stockUpdated
    const unsubscribe = onEvent('stockUpdated', handleStockUpdate);
    console.log('Abonnement aux événements de mise à jour des stocks configuré');
    
    // Se désabonner lors du démontage du composant
    return () => {
      unsubscribe();
      console.log('Désabonnement des événements de mise à jour des stocks');
    };
  }, []);

  // Déclaration de currentEmployee avant son utilisation dans useEffect
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  // Effet pour charger l'employé depuis le localStorage lors du chargement initial
  useEffect(() => {
    const savedEmployee = localStorage.getItem('currentEmployee');
    if (savedEmployee) {
      try {
        const parsedEmployee = JSON.parse(savedEmployee);
        setCurrentEmployee(parsedEmployee);
        console.log('Employé récupéré du localStorage:', parsedEmployee.firstName);
      } catch (error) {
        console.error('Erreur lors de la récupération de l\'employé du localStorage:', error);
        localStorage.removeItem('currentEmployee');
      }
    }
  }, []);

  // Effet pour sauvegarder l'employé dans le localStorage lorsqu'il change
  useEffect(() => {
    if (currentEmployee) {
      localStorage.setItem('currentEmployee', JSON.stringify(currentEmployee));
    }
  }, [currentEmployee]);

  // Vérification périodique du statut d'abonnement
  useEffect(() => {
    // Vérifier le statut d'abonnement immédiatement au démarrage
    const checkSubscription = async () => {
      await autoCheckSubscriptionStatus();
    };
    
    // Appeler immédiatement la vérification
    checkSubscription();
    
    // Configurer une vérification périodique (toutes les 10 minutes)
    const intervalId = setInterval(checkSubscription, 10 * 60 * 1000);
    
    // Nettoyer l'intervalle lors du démontage du composant
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Chargement des données initiales
  useEffect(() => {
    const loadData = async () => {
      if (currentEmployee) {
        try {
          // Charger les produits
          const productsData = await getProducts();
          setProducts(productsData);
          
          // Charger les catégories et supprimer les doublons
          const categoriesData = await getCategories();
          await removeDuplicateCategories(); // Supprimer les doublons de catégories
          const updatedCategories = await getCategories(); // Recharger les catégories après suppression des doublons
          setCategories(updatedCategories.map(cat => cat.name));
          
          // Charger les mouvements de stock
          const stockMovementsData = await fetchStockMovements();
          setStockMovements(stockMovementsData);
          
          // Charger les paramètres de l'application
          const settingsData = await getSettings();
          console.log('Paramètres récupérés depuis Firestore:', settingsData);
          setAppSettings(settingsData || defaultSettings);
        } catch (error) {
          console.error('Erreur lors du chargement des données:', error);
        }
      }
    };

    loadData();
  }, [currentEmployee]);

  const [showReceipt, setShowReceipt] = useState<ReceiptType | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBarcodeReader, setShowBarcodeReader] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [activeView, setActiveView] = useState<'pos' | 'history' | 'orders' | 'promotions' | 'employees' | 'stock' | 'reports' | 'settings' | 'loyalty' | 'qrcodes'>('pos');
  
  // Fonction pour changer de vue avec validation des permissions
  const handleViewChange = (view: 'pos' | 'history' | 'orders' | 'promotions' | 'employees' | 'stock' | 'reports' | 'settings' | 'loyalty' | 'qrcodes') => {
    console.log(`Changement de vue demandé: ${view}`, { 
      utilisateurActuel: currentEmployee ? `${currentEmployee.firstName} (${currentEmployee.role})` : 'Non connecté',
      vueActuelle: activeView,
      nouvelleVue: view
    });
    
    // Vérification que l'utilisateur est connecté
    if (!currentEmployee) {
      console.error('Tentative de changement de vue sans utilisateur connecté');
      return;
    }
    
    // Vérifier si l'utilisateur a la permission d'accéder à cette vue
    if (!hasPermissionForView(view)) {
      console.warn(`L'utilisateur ${currentEmployee.firstName} (${currentEmployee.role}) n'a pas la permission d'accéder à la vue ${view}`);
      console.log('Permissions de l\'utilisateur:', currentEmployee.permissions);
      alert(`Vous n'avez pas la permission d'accéder à cette vue.`);
      return;
    }
    
    try {
      // Changer la vue active
      setActiveView(view);
      console.log(`Vue changée avec succès vers: ${view}`);
      
      // Forcer un rafraîchissement du thème
      const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 
                          document.documentElement.classList.contains('theme-dark') ? 'dark' : 
                          document.documentElement.classList.contains('theme-light') ? 'light' :
                          document.documentElement.classList.contains('theme-blue') ? 'blue' :
                          document.documentElement.classList.contains('theme-green') ? 'green' :
                          document.documentElement.classList.contains('theme-purple') ? 'purple' :
                          document.documentElement.classList.contains('theme-orange') ? 'orange' :
                          document.documentElement.classList.contains('theme-custom') ? 'custom' : 'default';
      
      // Déclencher l'événement forceThemeUpdate pour s'assurer que le thème est correctement appliqué
      const event = new CustomEvent('forceThemeUpdate', {
        detail: { 
          theme: currentTheme, 
          timestamp: Date.now() 
        }
      });
      document.dispatchEvent(event);
      console.log(`Événement forceThemeUpdate déclenché après changement de vue avec thème: ${currentTheme}`);
    } catch (error) {
      console.error('Erreur lors du changement de vue:', error);
    }
  };
  const [showStockAlert, setShowStockAlert] = useState(false);
  const [showSupplierOrderModal, setShowSupplierOrderModal] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [showLoyaltyCardModal, setShowLoyaltyCardModal] = useState(false);
  const [showStockMovementModal, setShowStockMovementModal] = useState<Product | null>(null);
  const [showStockHistoryModal, setShowStockHistoryModal] = useState<Product | null>(null);
  // Les commandes fournisseurs sont maintenant gérées directement par le service Firebase
  const [selectedLoyaltyCard, setSelectedLoyaltyCard] = useState<LoyaltyCard | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [promotionsSearchQuery, setPromotionsSearchQuery] = useState('');
  const [employeesSearchQuery, setEmployeesSearchQuery] = useState('');
  const [loyaltySearchQuery, setLoyaltySearchQuery] = useState('');
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultSettings);
  const [loyaltyTiers, setLoyaltyTiers] = useState<LoyaltyTier[]>([
    { 
      name: 'bronze', 
      minimumPoints: 0, 
      discountPercentage: 5, 
      pointsMultiplier: 1, 
      color: 'amber-600',
      businessId: 'business1'
    },
    { 
      name: 'silver', 
      minimumPoints: 1000, 
      discountPercentage: 10, 
      pointsMultiplier: 1.2, 
      color: 'gray-500',
      businessId: 'business1'
    },
    { 
      name: 'gold', 
      minimumPoints: 3000, 
      discountPercentage: 15, 
      pointsMultiplier: 1.5, 
      color: 'yellow-500',
      businessId: 'business1'
    },
    { 
      name: 'platinum', 
      minimumPoints: 5000, 
      discountPercentage: 20, 
      pointsMultiplier: 2, 
      color: 'indigo-600',
      businessId: 'business1'
    }
  ]);
  
  // Les produits sont maintenant chargés depuis Firebase, donc nous initialisons avec un tableau vide
  const [products, setProducts] = useState<Product[]>([]);
  
  // Les catégories sont maintenant chargées depuis Firebase
  const [categories, setCategories] = useState<string[]>([]);

  const [loyaltyCards, setLoyaltyCards] = useState<LoyaltyCard[]>([
    {
      id: '1',
      number: 'LC20240001',
      customerName: 'Jean Dupont',
      email: 'jean.dupont@email.com',
      phone: '+32 470 12 34 56',
      points: 450,
      tier: 'gold',
      createdAt: new Date('2023-01-15'),
      lastUsed: new Date('2024-01-10'),
      businessId: 'business1'
    },
    {
      id: '2',
      number: 'LC20240002',
      customerName: 'Marie Lambert',
      email: 'marie.lambert@email.com',
      phone: '+32 475 98 76 54',
      points: 150,
      tier: 'silver',
      createdAt: new Date('2023-06-20'),
      lastUsed: new Date('2024-01-05'),
      businessId: 'business1'
    },
    {
      id: '3',
      number: 'LC20240003',
      customerName: 'Ahmed Ben Ali',
      email: 'ahmed.benali@email.com',
      phone: '+32 488 11 22 33',
      points: 750,
      tier: 'platinum',
      createdAt: new Date('2023-03-10'),
      lastUsed: new Date('2024-01-12'),
      businessId: 'business1'
    }
  ]);

  const demoEmployees: Employee[] = [
    {
      id: '1',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      role: 'admin',
      pin: '1234',
      active: true,
      createdAt: new Date('2023-01-01'),
      businessId: 'business1',
      permissions: [
        { id: 'pos', name: 'POS', description: 'Accès à la caisse', category: 'pos', level: 'write', businessId: 'business1' },
        { id: 'inventory', name: 'Inventaire', description: 'Gestion du stock', category: 'inventory', level: 'write', businessId: 'business1' },
        { id: 'reports', name: 'Rapports', description: 'Accès aux rapports', category: 'reports', level: 'read', businessId: 'business1' }
      ]
    },
    {
      id: '2',
      firstName: 'Manager',
      lastName: 'User',
      email: 'manager@example.com',
      role: 'manager',
      pin: '2345',
      active: true,
      createdAt: new Date('2023-03-15'),
      businessId: 'business1',
      permissions: [
        { id: 'pos', name: 'POS', description: 'Accès à la caisse', category: 'pos', level: 'write', businessId: 'business1' },
        { id: 'inventory', name: 'Inventaire', description: 'Gestion du stock', category: 'inventory', level: 'write', businessId: 'business1' }
      ]
    },
    {
      id: '3',
      firstName: 'Caissier',
      lastName: 'User',
      email: 'cashier@example.com',
      role: 'cashier',
      pin: '3456',
      active: true,
      createdAt: new Date('2023-06-01'),
      businessId: 'business1',
      permissions: [
        { id: 'pos', name: 'POS', description: 'Accès à la caisse', category: 'pos', level: 'write', businessId: 'business1' }
      ]
    }
  ];

  const handleAddProduct = async (productData: Omit<Product, 'id'>) => {
    console.log('====== DÉBUT DE LA CRÉATION D’UN PRODUIT ======');
    console.log('Données du produit reçues:', JSON.stringify(productData, null, 2));
    console.log('Employé actuel:', currentEmployee ? `${currentEmployee.firstName} ${currentEmployee.lastName} (${currentEmployee.role})` : 'Non connecté');
    
    // Vérifier que l'utilisateur est connecté
    if (!currentEmployee) {
      console.error('ERREUR: Tentative d\'ajout de produit sans employé connecté');
      alert('Vous devez être connecté pour ajouter un produit.');
      return;
    }
    
    // Simplification des permissions : admin et gérant sont autorisés automatiquement
    if (currentEmployee.role === 'admin' || currentEmployee.role === 'manager') {
      console.log('Utilisateur admin/gérant - permission automatiquement accordée');
    } else {
      console.error('ERREUR: L\'employé n\'a pas la permission de créer des produits (rôle non autorisé)');
      alert('Vous n\'avez pas la permission d\'ajouter des produits.');
      return;
    }
    
    try {
      console.log('Appel du service addProduct...');
      // Utiliser le service pour ajouter le produit à Firebase
      const newProduct = await addProduct(productData);
      
      if (newProduct) {
        console.log('Produit ajouté avec succès:', newProduct.id);
        // Mettre à jour l'état local des produits
        setProducts(prev => [...prev, newProduct]);
        console.log('Liste des produits mise à jour, nombre total:', products.length + 1);
        
        // Si le stock initial est supérieur à 0, créer un mouvement de stock initial
        if (newProduct.stock > 0) {
          console.log('Création d\'un mouvement de stock initial pour', newProduct.stock, 'unités');
          const adjustment: StockAdjustment = {
            productId: newProduct.id,
            quantity: newProduct.stock,
            type: 'adjustment',
            reason: 'Stock initial',
            employeeId: currentEmployee?.id || '',
            businessId: 'business1'
          };
          
          // Utiliser le service pour enregistrer le mouvement de stock dans Firebase
          const movement = await adjustStock(adjustment);
          if (movement) {
            setStockMovements(prev => [...prev, movement]);
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout du produit:', error);
      alert('Erreur lors de l\'ajout du produit. Veuillez réessayer.');
    }
  };

  // Cette fonction a été déplacée plus bas dans le code

  const handleStockAdjustment = async (adjustment: StockAdjustment) => {
    // Trouver le produit concerné
    const product = products.find(p => p.id === adjustment.productId);
    if (!product) return;
    
    // Compléter l'ajustement avec l'ID de l'employé
    const completeAdjustment = {
      ...adjustment,
      employeeId: currentEmployee?.id || ''
    };
    
    try {
      // Utiliser le service pour ajuster le stock et enregistrer le mouvement dans Firebase
      const movement = await adjustStock(completeAdjustment);
      
      if (movement) {
        // Mettre à jour l'état local des produits
        setProducts(prev => 
          prev.map(p => {
            if (p.id === adjustment.productId) {
              return { ...p, stock: movement.newStock };
            }
            return p;
          })
        );
        
        // Ajouter le mouvement à l'état local des mouvements de stock
        setStockMovements(prev => [...prev, movement]);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajustement du stock:', error);
      alert('Erreur lors de l\'ajustement du stock. Veuillez réessayer.');
    }
  };

  const handleProductSelect = (product: Product) => {
    // Vérifier si le produit est en rupture de stock
    if (product.stock <= 0) {
      alert(`Le produit "${product.name}" est en rupture de stock.`);
      return;
    }
    
    setCartItems((prevItems) => {
      const existingItem = prevItems.find(
        (item) => item.product.id === product.id
      );

      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          alert(`Stock insuffisant pour ${product.name}. Stock disponible: ${product.stock}`);
          return prevItems;
        }
        return prevItems.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...prevItems, { product, quantity: 1, businessId: product.businessId }];
    });
  };
  
  // Fonction pour gérer la lecture d'un code-barres
  const handleBarcodeDetection = (barcode: string) => {
    // Rechercher le produit correspondant au code-barres
    const product = findProductByBarcode(barcode, products);
    
    if (product) {
      // Produit trouvé, l'ajouter au panier
      handleProductSelect(product);
    } else {
      // Produit non trouvé, afficher une alerte
      alert(`Aucun produit trouvé avec le code-barres: ${barcode}`);
    }
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setCartItems((prevItems) =>
      prevItems
        .map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.product.id !== productId)
    );
  };

  const handleCheckout = () => {
    setShowPaymentModal(true);
  };

  const calculatePromotionalPrice = (product: Product, quantity: number): number => {
    // Vérifier si le produit a une promotion
    if (!product.promotion) {
      return product.price * quantity;
    }
    
    // Normaliser la promotion pour assurer la cohérence
    const normalizedPromotion = normalizePromotion(product.promotion);
    if (!normalizedPromotion) {
      return product.price * quantity;
    }
    
    // Vérifier si la promotion est active
    const isActive = isPromotionActive(normalizedPromotion);
    
    if (!isActive) {
      return product.price * quantity;
    }

    switch (normalizedPromotion.type) {
      case 'percentage':
        return product.price * quantity * (1 - normalizedPromotion.value / 100);
      case 'fixed':
        return Math.max(0, (product.price - normalizedPromotion.value) * quantity);
      case 'buyXgetY':
        if (normalizedPromotion.buyQuantity && normalizedPromotion.getFreeQuantity) {
          const sets = Math.floor(quantity / (normalizedPromotion.buyQuantity + normalizedPromotion.getFreeQuantity));
          const remainder = quantity % (normalizedPromotion.buyQuantity + normalizedPromotion.getFreeQuantity);
          return (sets * normalizedPromotion.buyQuantity + Math.min(remainder, normalizedPromotion.buyQuantity)) * product.price;
        }
        return product.price * quantity;
      default:
        return product.price * quantity;
    }
  };

  const isPromotionActive = (promotion: Promotion): boolean => {
    const now = new Date();
    
    // S'assurer que les dates sont des objets Date valides
    let startDate = promotion.startDate;
    let endDate = promotion.endDate;
    
    // Si les dates ne sont pas des objets Date valides, les convertir
    if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
      startDate = new Date(startDate);
    }
    
    if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
      endDate = new Date(endDate);
    }
    
    return now >= startDate && now <= endDate;
  };

  const handleCreateOrder = () => {
    setEditOrderId(null); // Mode création
    setShowSupplierOrderModal(true);
  };
  
  const handleEditOrder = (orderId: string, onSuccess?: () => void) => {
    setEditOrderId(orderId); // Mode édition
    setShowSupplierOrderModal(true);
  };

  const handleUpdatePromotion = (productId: string, promotion: Promotion | undefined) => {
    // Mettre à jour l'état local immédiatement pour une meilleure réactivité de l'UI
    setProducts(prevProducts =>
      prevProducts.map(product =>
        product.id === productId
          ? { ...product, promotion }
          : product
      )
    );
    
    // Note: La mise à jour dans Firebase est déjà gérée par le service de promotion
    // dans le composant PromotionsManager via updateProductPromotion
  };

  // Cette fonction est maintenant utilisée dans handleUpdatePromotion
  const handleUpdateProduct = async (productId: string, updates: Partial<Product>) => {
    try {
      // Mettre à jour le produit dans Firebase
      const success = await updateProduct(productId, updates);
      
      if (success) {
        // Mettre à jour l'état local
        setProducts(prev =>
          prev.map(product =>
            product.id === productId
              ? { ...product, ...updates }
              : product
          )
        );
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du produit:', error);
      alert('Erreur lors de la mise à jour du produit. Veuillez réessayer.');
    }
  };
  
  /**
   * Gère la suppression d'un produit avec vérifications de permission
   */
  const handleDeleteProduct = async (productId: string) => {
    console.log('====== DÉBUT DE LA SUPPRESSION D\'UN PRODUIT ======');
    console.log('ID du produit à supprimer:', productId);
    
    // Vérifier que l'utilisateur est connecté
    if (!currentEmployee) {
      console.error('ERREUR: Tentative de suppression de produit sans employé connecté');
      alert('Vous devez être connecté pour supprimer un produit.');
      return false;
    }
    
    console.log('Employé actuel:', `${currentEmployee.firstName} ${currentEmployee.lastName} (${currentEmployee.role})`);
    
    // Vérification des permissions: seuls admin et gérant peuvent supprimer
    if (!(currentEmployee.role === 'admin' || currentEmployee.role === 'manager')) {
      console.error('ERREUR: L\'employé n\'a pas la permission de supprimer des produits');
      alert('Vous n\'avez pas la permission de supprimer des produits.');
      return false;
    }
    
    // Confirmation de suppression
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.')) {
      console.log('Suppression annulée par l\'utilisateur');
      return false;
    }
    
    try {
      // Supprimer le produit de Firebase
      console.log('Appel du service deleteProduct...');
      const success = await deleteProduct(productId);
      
      if (success) {
        console.log('Produit supprimé avec succès');
        
        // Supprimer le produit de l'état local
        setProducts(prev => prev.filter(product => product.id !== productId));
        
        // Supprimer également le produit du panier s'il y est
        setCartItems(prev => prev.filter(item => item.product.id !== productId));
        
        // Notification de succès
        alert('Le produit a été supprimé avec succès.');
        return true;
      } else {
        console.error('Échec de la suppression du produit');
        alert('Erreur lors de la suppression du produit. Veuillez réessayer.');
        return false;
      }
    } catch (error) {
      console.error('Erreur lors de la suppression du produit:', error);
      alert('Erreur lors de la suppression du produit. Veuillez réessayer.');
      return false;
    }
  };
  
  const handleDeleteMultipleProducts = async (productIds: string[]) => {
    try {
      // Créer un tableau de promesses pour supprimer tous les produits sélectionnés
      const deletePromises = productIds.map(id => deleteProduct(id));
      
      // Attendre que toutes les opérations de suppression soient terminées
      const results = await Promise.all(deletePromises);
      
      // Vérifier si toutes les suppressions ont réussi
      const allSuccessful = results.every(result => result === true);
      
      if (allSuccessful) {
        // Mettre à jour l'état local des produits
        setProducts(prev => prev.filter(product => !productIds.includes(product.id)));
        
        // Mettre à jour le panier en supprimant les produits supprimés
        setCartItems(prev => prev.filter(item => !productIds.includes(item.product.id)));
        
        alert(`${productIds.length} produit(s) supprimé(s) avec succès.`);
      } else {
        alert('Certains produits n\'ont pas pu être supprimés. Veuillez réessayer.');
      }
    } catch (error) {
      console.error('Erreur lors de la suppression des produits:', error);
      alert('Erreur lors de la suppression des produits. Veuillez réessayer.');
    }
  };
  
  const handleAddCategory = async (categoryName: string) => {
    try {
      // Vérifier si la catégorie existe déjà dans l'état local
      if (categories.includes(categoryName)) {
        return;
      }

      // Vérifier si la catégorie existe déjà dans Firebase
      const categoriesData = await getCategories();
      const existingCategory = categoriesData.find(cat => cat.name === categoryName);
      
      if (existingCategory) {
        // La catégorie existe déjà dans Firebase mais pas dans l'état local
        setCategories(prev => [...prev, categoryName]);
        return;
      }
      
      // Ajouter la catégorie à Firebase
      const newCategory = await addCategory({ name: categoryName });
      if (newCategory) {
        setCategories(prev => [...prev, categoryName]);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la catégorie:', error);
    }
  };
  
  const handleUpdateCategory = async (oldCategoryName: string, newCategoryName: string) => {
    try {
      // Trouver l'ID de la catégorie à mettre à jour
      const categoriesData = await getCategories();
      const categoryToUpdate = categoriesData.find(cat => cat.name === oldCategoryName);
      
      if (categoryToUpdate) {
        // Mettre à jour la catégorie dans Firebase
        const success = await updateCategory(categoryToUpdate.id, { name: newCategoryName });
        
        if (success) {
          // Mettre à jour l'état local des catégories
          setCategories(prev => prev.map(cat => cat === oldCategoryName ? newCategoryName : cat));
          
          // Mettre à jour tous les produits qui utilisent cette catégorie
          setProducts(prev => prev.map(product => {
            if (product.category === oldCategoryName) {
              return { ...product, category: newCategoryName };
            }
            return product;
          }));
        }
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la catégorie:', error);
    }
  };
  
  const handleDeleteCategory = async (categoryName: string) => {
    try {
      // Vérifier si la catégorie est utilisée par des produits
      const isUsed = products.some(product => product.category === categoryName);
      
      if (isUsed) {
        alert('Impossible de supprimer une catégorie utilisée par des produits.');
        return;
      }
      
      // Rechercher la catégorie dans Firestore pour obtenir son ID
      const categoriesResult = await getCategories();
      const categoryToDelete = categoriesResult.find(cat => {
        const catName = typeof cat === 'object' && cat !== null && 'name' in cat ? cat.name : String(cat);
        return catName === categoryName;
      });
      
      // Si la catégorie n'existe pas dans Firestore, c'est un problème
      if (!categoryToDelete || !categoryToDelete.id) {
        console.error(`Catégorie "${categoryName}" introuvable dans Firestore`);
        alert(`Impossible de supprimer la catégorie "${categoryName}". Elle n'existe pas dans la base de données.`);
        return;
      }
      
      // Supprimer la catégorie de Firebase
      console.log(`Suppression de la catégorie: ${categoryToDelete.id} (${categoryName})`);
      const success = await deleteCategory(categoryToDelete.id);
      
      if (success) {
        console.log('Suppression réussie de la catégorie:', categoryName);
        
        // Mettre à jour l'état local UNIQUEMENT si la suppression dans Firestore a réussi
        setCategories(prev => prev.filter(cat => {
          const catName = typeof cat === 'object' && cat !== null && 'name' in cat ? cat.name : String(cat);
          return catName !== categoryName;
        }));
      } else {
        console.error(`Échec de la suppression de la catégorie "${categoryName}" dans Firestore`);
        alert(`Échec de la suppression de la catégorie "${categoryName}". Veuillez réessayer.`);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression de la catégorie:', error);
      alert('Une erreur est survenue lors de la suppression de la catégorie. Veuillez réessayer.');
    }
  };

  const handleCreateLoyaltyCard = (cardData: Omit<LoyaltyCard, 'id' | 'points' | 'tier' | 'createdAt'>) => {
    const newCard: LoyaltyCard = {
      ...cardData,
      id: crypto.randomUUID(),
      points: 0,
      tier: 'bronze',
      createdAt: new Date(),
      businessId: 'business1'
    };

    setLoyaltyCards(prev => [...prev, newCard]);
    setSelectedLoyaltyCard(newCard);
    setShowLoyaltyCardModal(false);
  };

  const handleUpdateLoyaltyCard = (id: string, updates: Partial<LoyaltyCard>) => {
    setLoyaltyCards(prev => 
      prev.map(card => 
        card.id === id ? { ...card, ...updates } : card
      )
    );
    
    // Si la carte mise à jour est la carte sélectionnée, mettre également à jour selectedLoyaltyCard
    if (selectedLoyaltyCard && selectedLoyaltyCard.id === id) {
      setSelectedLoyaltyCard(prev => prev ? { ...prev, ...updates } : prev);
    }
  };

  const handleDeleteLoyaltyCard = (id: string) => {
    setLoyaltyCards(prev => prev.filter(card => card.id !== id));
    
    // Si la carte supprimée est la carte sélectionnée, réinitialiser selectedLoyaltyCard
    if (selectedLoyaltyCard && selectedLoyaltyCard.id === id) {
      setSelectedLoyaltyCard(undefined);
    }
  };

  const handleUpdateLoyaltyTier = (name: LoyaltyTier['name'], updates: Partial<LoyaltyTier>) => {
    setLoyaltyTiers(prev => 
      prev.map(tier => 
        tier.name === name ? { ...tier, ...updates } : tier
      )
    );
  };

  const getLoyaltyDiscount = (card?: LoyaltyCard): number => {
    if (!card) return 0;
    // Définition des tiers de fidélité
    const loyaltyTier = loyaltyTiers.find(t => t.name === card.tier);
    return loyaltyTier ? loyaltyTier.discountPercentage / 100 : 0;
  };

  const handlePaymentComplete = async (method: 'cash' | 'card', amountReceived: number) => {
    try {
      const total = cartItems.reduce(
        (sum, item) => sum + calculatePromotionalPrice(item.product, item.quantity),
        0
      );

      const finalTotal = total * (1 - getLoyaltyDiscount(selectedLoyaltyCard));
      const receiptNumber = generateReceiptNumber();

      const currentUser = auth.currentUser;
      const businessId = currentUser ? currentUser.uid : 'business1';
      
      if (!businessId) {
        console.error("Erreur critique: Aucun businessId disponible");
        throw new Error('Aucun utilisateur connecté');
      }

      // Vérifier que tous les cartItems ont un businessId
      const cartItemsWithBusinessId = cartItems.map(item => {
        // Si l'item n'a pas de businessId, on utilise celui du produit
        if (!item.businessId && item.product.businessId) {
          return {
            ...item,
            businessId: item.product.businessId
          };
        }
        return item;
      });

      // Créer l'objet de vente avec ou sans carte de fidélité
      const sale: Omit<Sale, 'id'> = {
        items: cartItemsWithBusinessId,
        subtotal: total,
        total: finalTotal,
        timestamp: new Date(),
        paymentMethod: method,
        receiptNumber: receiptNumber,
        amountReceived,
        change: amountReceived - finalTotal,
        employeeId: currentEmployee?.id || '',
        vatAmounts: {
          vat6: 0,
          vat12: 0,
          vat21: 0
        },
        businessId
      };

      // Ajouter la carte de fidélité et les points seulement si une carte est sélectionnée
      if (selectedLoyaltyCard && selectedLoyaltyCard.id) {
        sale.loyaltyCard = selectedLoyaltyCard;
        sale.pointsEarned = Math.floor(finalTotal);
      }

      // Sauvegarder la vente dans Firebase
      const savedSale = await addSale(sale);
      
      if (!savedSale) {
        console.error("La vente n'a pas pu être sauvegardée dans Firebase");
        throw new Error('La vente n\'a pas pu être sauvegardée');
      }
      
      const receipt: ReceiptType = {
        sale: savedSale,
        businessName: appSettings.general.storeName,
        address: appSettings.general.address,
        phone: appSettings.general.phone,
        email: appSettings.general.email,
        vatNumber: appSettings.general.vatNumber,
        businessId: savedSale.businessId
      };

      // Fermer d'abord le modal de paiement, puis afficher le reçu
      setShowPaymentModal(false);
      
      // Utiliser un délai pour s'assurer que le modal est bien fermé avant d'afficher le reçu
      setTimeout(() => {
        setShowReceipt(receipt);
        setCartItems([]);
        setSelectedLoyaltyCard(undefined);
      }, 100);

      // Mettre à jour le stock et enregistrer les mouvements dans Firebase
      const updatedProducts = [...products];
      const stockMovementPromises = [];
      
      // Pour chaque article vendu, créer un mouvement de stock
      for (const item of cartItems) {
        const productIndex = updatedProducts.findIndex(p => p.id === item.product.id);
        if (productIndex !== -1) {
          const product = updatedProducts[productIndex];
          const newStock = product.stock - item.quantity;
          
          // Ajouter le mouvement à Firebase et à l'état local
          try {
            const promise = adjustStock({
              productId: product.id,
              quantity: -item.quantity,
              type: 'adjustment',
              reason: 'Vente - ' + receiptNumber,
              employeeId: currentEmployee?.id || '',
              reference: receiptNumber
              // businessId sera ajouté automatiquement par le service adjustStock
            }, product.stock);
            
            stockMovementPromises.push(promise);
            
            // Mettre à jour le produit dans notre tableau temporaire
            updatedProducts[productIndex] = {
              ...product,
              stock: newStock
            };
          } catch (error) {
            console.error(`Erreur lors de l'ajustement du stock pour ${product.name}:`, error);
          }
        } else {
          console.error(`Produit non trouvé dans la liste locale: ${item.product.id}`);
        }
      }
      
      // Attendre que tous les mouvements de stock soient enregistrés
      Promise.all(stockMovementPromises)
        .then(movements => {
          // Filtrer les mouvements null
          const validMovements = movements.filter(m => m !== null) as StockMovement[];
          
          // Mettre à jour l'état local des mouvements de stock
          if (validMovements.length > 0) {
            setStockMovements((prev: StockMovement[]) => [...validMovements, ...prev]);
          }
          
          // Mettre à jour l'état local des produits
          setProducts(updatedProducts);
        })
        .catch(error => {
          console.error('Erreur lors de l\'enregistrement des mouvements de stock:', error);
        });
    } catch (error) {
      console.error('Erreur lors du paiement:', error);
      if (error instanceof Error) {
        console.error('Message d\'erreur:', error.message);
        console.error('Stack trace:', error.stack);
      }
      alert('Erreur lors de la sauvegarde de la vente. Veuillez réessayer.');
      setShowPaymentModal(false);
    }
  };

  const generateReceiptNumber = () => {
    const timestamp = new Date().getTime().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `BE${timestamp}${random}`;
  };

  // Fonction pour vérifier si l'utilisateur a accès à une vue spécifique
  const hasPermissionForView = useCallback((view: string): boolean => {
    if (!currentEmployee) return false;
    
    // Les administrateurs ont accès à tout
    if (currentEmployee.role === 'admin') return true;
    
    // Les managers ont accès à toutes les vues principales (sauf paramètres avancés)
    if (currentEmployee.role === 'manager') {
      const managerViews = ['pos', 'history', 'orders', 'promotions', 'employees', 'stock', 'reports', 'loyalty'];
      if (managerViews.includes(view)) {
        console.log(`hasPermission App.tsx : Le manager a accès à la vue ${view}`);
        return true;
      }
    }
    
    // Pour les caissiers, accorder accès à certaines vues spécifiques par défaut
    if (currentEmployee.role === 'cashier') {
      const cashierViews = ['pos', 'history', 'stock', 'orders', 'promotions', 'loyalty', 'employees'];
      if (cashierViews.includes(view)) {
        console.log(`hasPermission App.tsx : Le caissier a accès à la vue ${view} (accès direct)`);
        return true;
      }
    }
    
    // Vérification des permissions dans le profil de l'utilisateur
    const hasPermission = canAccessView(currentEmployee, view);
    console.log(`hasPermission App.tsx : Vérification de permission pour ${view}: ${hasPermission}`);
    return hasPermission;
  }, [currentEmployee]);

  const handleLogout = async () => {
    try {
      // Ne pas déconnecter de Firebase, simplement réinitialiser l'état de l'employé
      setCurrentEmployee(null);
      console.log('Employé déconnecté de l\'application');
      localStorage.removeItem('currentEmployee');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  const handleViewReceipt = (sale: Sale) => {
    const receipt: ReceiptType = {
      sale,
      businessName: appSettings.general.storeName,
      address: appSettings.general.address,
      phone: appSettings.general.phone,
      email: appSettings.general.email,
      vatNumber: appSettings.general.vatNumber,
      businessId: sale.businessId
    };
    
    setShowReceipt(receipt);
  };

  if (!currentEmployee) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-gray-100" id="login-page">
        {/* ThemeObserver fonctionne même sur la page de login, mais n'applique pas les couleurs du thème */}
        <ThemeObserver excludeLoginPage={true} />
        <EmployeeLogin onLogin={setCurrentEmployee} />
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ currentEmployee, setCurrentEmployee }}>
      <div className="flex h-screen app-background" id="main-app-container">
        {/* Assure que les thèmes sont correctement appliqués à tous les composants */}
        <ThemeObserver excludeLoginPage={true} />
        {/* Sidebar masquée en mobile, visible uniquement sur desktop */}
        <div className="hidden md:block">
          <Sidebar
            activeView={activeView}
            onViewChange={handleViewChange}
            currentEmployee={currentEmployee}
            onLogout={handleLogout}
            hasPermission={hasPermissionForView}
          />
        </div>

        {/* Header mobile persistant sur toutes les pages */}
        <div className="md:hidden bg-gradient-to-r from-slate-800 to-slate-700 dark:from-gray-900 dark:to-gray-800 px-4 py-2 shadow-lg fixed top-0 left-0 right-0 z-30">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <Menu size={18} className="text-white" />
            </button>
            
            <div className="text-center">
              <h1 className="text-lg font-bold text-white" data-testid="page-title">
                {activeView === 'pos' ? 'Caisse' :
                 activeView === 'history' ? 'Historique' :
                 activeView === 'stock' ? 'Stock' :
                 activeView === 'orders' ? 'Commandes' :
                 activeView === 'promotions' ? 'Promotions' :
                 activeView === 'loyalty' ? 'Fidélité' :
                 activeView === 'reports' ? 'Rapports' :
                 activeView === 'employees' ? 'Employés' :
                 activeView === 'settings' ? 'Paramètres' :
                 activeView === 'qrcodes' ? 'QR Codes' :
                 'PaySmart'}
              </h1>
              <div className="text-white text-xs opacity-90">
                {appSettings.general.storeName}
              </div>
            </div>
            
            {(activeView === 'pos' || activeView === 'history' || activeView === 'stock' || activeView === 'promotions' || activeView === 'employees' || activeView === 'loyalty') && (
              <button
                onClick={() => setShowSearchBar(!showSearchBar)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <Search size={18} className="text-white" />
              </button>
            )}
            {!(activeView === 'pos' || activeView === 'history' || activeView === 'stock' || activeView === 'promotions' || activeView === 'employees' || activeView === 'loyalty') && (
              <div className="w-10 h-10"></div>
            )}
          </div>
          
          {/* Barre de recherche dépliable - POS et Historique */}
          {showSearchBar && activeView === 'pos' && (
            <div className="mt-3 relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border-0 bg-white/10 backdrop-blur-sm text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/20 transition-all"
                autoFocus
              />
            </div>
          )}
          {showSearchBar && activeView === 'history' && (
            <div className="mt-3 relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Rechercher une vente..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border-0 bg-white/10 backdrop-blur-sm text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/20 transition-all"
                autoFocus
              />
            </div>
          )}
          {showSearchBar && activeView === 'stock' && (
            <div className="mt-3 relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Rechercher un produit..."
                value={stockSearchQuery}
                onChange={(e) => setStockSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border-0 bg-white/10 backdrop-blur-sm text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/20 transition-all"
                autoFocus
              />
            </div>
          )}
          {showSearchBar && activeView === 'promotions' && (
            <div className="mt-3 relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Rechercher une promotion..."
                value={promotionsSearchQuery}
                onChange={(e) => setPromotionsSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border-0 bg-white/10 backdrop-blur-sm text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/20 transition-all"
                autoFocus
              />
            </div>
          )}
          {showSearchBar && activeView === 'employees' && (
            <div className="mt-3 relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Rechercher un employé..."
                value={employeesSearchQuery}
                onChange={(e) => setEmployeesSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border-0 bg-white/10 backdrop-blur-sm text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/20 transition-all"
                autoFocus
              />
            </div>
          )}
          {showSearchBar && activeView === 'loyalty' && (
            <div className="mt-3 relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Rechercher un client..."
                value={loyaltySearchQuery}
                onChange={(e) => setLoyaltySearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border-0 bg-white/10 backdrop-blur-sm text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/20 transition-all"
                autoFocus
              />
            </div>
          )}
        </div>
        
        {activeView === 'pos' ? (
          <div className="flex-1 h-full relative">
            {/* Version desktop avec panier fixe à droite */}
            <div className="hidden md:flex h-full">
              <div className="flex-grow overflow-auto content-background" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }} id="main-content-area">
                <div className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 md:gap-0">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white" data-testid="store-title">
                      {appSettings.general.storeName} - Caisse
                    </h1>
                    <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
                      {/* Zone de recherche et scanner de code-barres - version compacte */}
                      <div className="flex w-full md:w-auto gap-2">
                        <div className="w-full md:w-48">
                          <div className="relative h-8">
                            <div className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-[color:var(--color-primary)] dark:text-[color:var(--color-primary)]">
                              <Search size={16} />
                            </div>
                            <input
                              type="text"
                              placeholder="Rechercher..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full h-full pl-8 pr-3 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)] dark:focus:ring-[color:var(--color-primary)]"
                            />
                          </div>
                        </div>
                        <div className="w-full md:w-40 h-8">
                          <SimpleBarcodeReader 
                            onBarcodeDetected={handleBarcodeDetection} 
                            products={products}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <ProductGrid 
                    products={products}
                    onProductSelect={handleProductSelect}
                    onDeleteProduct={handleDeleteProduct}
                    searchQuery={searchQuery}
                    categories={categories}
                  />
                </div>
              </div>
              <div className="w-full md:w-80 lg:w-72 xl:w-80 border-l card-background flex-none md:flex-none" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
                <Cart
                  items={cartItems}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemoveItem={handleRemoveItem}
                  onCheckout={handleCheckout}
                  calculatePromotionalPrice={calculatePromotionalPrice}
                />
              </div>
            </div>
            
            {/* Version mobile professionnelle pour vendeurs */}
            <div className="flex flex-col h-full md:hidden pt-16">
              {/* Grille de produits avec style professionnel */}
              <div className="flex-1 overflow-auto" style={{ backgroundColor: 'var(--color-background)' }}>
                <div className="p-4">
                  <ProductGrid 
                    products={products}
                    onProductSelect={handleProductSelect}
                    onDeleteProduct={handleDeleteProduct}
                    searchQuery={searchQuery}
                    categories={categories}
                  />
                </div>
              </div>
              
              {/* Panier fixe professionnel en bas */}
              <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t-2 border-slate-200 dark:border-gray-600 shadow-2xl">
                {cartItems.length > 0 ? (
                  <div className="px-2 sm:px-4 py-3 sm:py-4">
                    {/* Résumé du panier */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-0 sm:justify-between mb-3">
                      <button 
                        className="flex items-center gap-2 sm:gap-4 flex-1 sm:mr-4 p-3 sm:p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => setShowMobileCart(!showMobileCart)}
                      >
                        <div className="relative">
                          <div className="bg-slate-100 dark:bg-gray-700 p-2 sm:p-3 rounded-full">
                            <ShoppingCart size={20} className="text-slate-600 dark:text-gray-300 sm:w-6 sm:h-6" />
                          </div>
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs sm:text-sm rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center font-bold">
                            {cartItems.length}
                          </span>
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                          <div className="text-base sm:text-base text-gray-500 dark:text-gray-400">Total</div>
                          <div className="text-2xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                            {cartItems.reduce((sum, item) => sum + calculatePromotionalPrice(item.product, item.quantity), 0).toFixed(2)} €
                          </div>
                        </div>
                        <div className="ml-auto">
                          <div className={`transform transition-transform text-base sm:text-lg ${showMobileCart ? 'rotate-180' : ''}`}>
                            ▲
                          </div>
                        </div>
                      </button>
                      
                      {/* Bouton de paiement professionnel */}
                      <button
                        onClick={handleCheckout}
                        disabled={cartItems.length === 0}
                        className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-4 sm:py-5 px-8 sm:px-14 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 w-full sm:w-auto"
                      >
                        <div className="flex items-center gap-2">
                          <span>PAYER</span>
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        </div>
                      </button>
                    </div>
                    
                    {/* Détails du panier mobile avec design desktop */}
                    {showMobileCart && (
                      <div className="mb-3 bg-[color:var(--color-background-alt)] rounded-lg p-3 max-h-60 overflow-y-auto border border-[color:var(--color-border)]">
                        <div className="space-y-2">
                          {cartItems.map((item) => {
                            const hasPromotion = item.product.promotion !== undefined;
                            const isLowStock = item.quantity > item.product.stock;
                            const regularPrice = item.product.price * item.quantity;
                            const promotionalPrice = calculatePromotionalPrice(item.product, item.quantity);
                            const discount = regularPrice - promotionalPrice;
                            
                            return (
                              <div 
                                key={`${item.product.id}-mobile`} 
                                className={`bg-[color:var(--color-card-bg)] rounded-lg p-2 ${
                                  isLowStock ? 'border-l-4 border-[color:var(--color-error)]' : ''
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="w-10 h-10 rounded-md overflow-hidden bg-[color:var(--color-background-alt)] flex-shrink-0">
                                    {item.product.image ? (
                                      <img 
                                        src={item.product.image} 
                                        alt={item.product.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-[color:var(--color-background-alt)]">
                                        <Tag className="text-[color:var(--color-text-secondary)]" size={16} />
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-col">
                                      <h3 className="text-sm font-medium text-[color:var(--color-text)] truncate mb-1">
                                        {item.product.name}
                                      </h3>
                                      <div className="flex flex-col text-xs text-[color:var(--color-text-secondary)]">
                                        <span>{item.product.price.toFixed(2)} € × {item.quantity}</span>
                                      </div>
                                    </div>
                                    
                                    {hasPromotion && discount > 0 && (
                                      <div className="flex items-center gap-1 text-xs text-[color:var(--color-success)] mt-1">
                                        <Tag size={12} />
                                        <span>Économie: {discount.toFixed(2)} €</span>
                                      </div>
                                    )}
                                    
                                    {isLowStock && (
                                      <div className="flex items-center gap-1 text-xs text-[color:var(--color-error)] mt-1">
                                        <AlertTriangle size={12} />
                                        <span>Stock insuffisant ({item.product.stock} disponible)</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex justify-between items-center mt-2 gap-2">
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                                      disabled={item.quantity <= 1}
                                      className="p-1 rounded bg-[color:var(--color-background-alt)] text-[color:var(--color-text)] disabled:opacity-50 hover:bg-[color:var(--color-secondary-alt)]"
                                    >
                                      <ChevronDown size={14} />
                                    </button>
                                    <span className="w-8 text-center text-sm text-[color:var(--color-text)]">{item.quantity}</span>
                                    <button
                                      onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                                      className="p-1 rounded bg-[color:var(--color-background-alt)] text-[color:var(--color-text)] hover:bg-[color:var(--color-secondary-alt)]"
                                    >
                                      <ChevronUp size={14} />
                                    </button>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-[color:var(--color-text)] dark:text-[#f6941c]">
                                      {promotionalPrice.toFixed(2)} €
                                    </span>
                                    <button
                                      onClick={() => handleRemoveItem(item.product.id)}
                                      className="p-1 rounded-full hover:bg-[color:var(--color-error)]/30 text-[color:var(--color-error)]"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Barre de progression visuelle */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                      <div 
                        className="bg-gradient-to-r from-orange-400 to-orange-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: cartItems.length > 0 ? '100%' : '0%' }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center">
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full w-12 h-12 mx-auto mb-2 flex items-center justify-center">
                      <ShoppingCart size={20} className="text-gray-400" />
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-sm">
                      Panier vide - Sélectionnez des produits
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Menu mobile sidebar */}
            {showMobileMenu && (
                <div className="fixed left-0 top-0 bottom-0 w-80 bg-gradient-to-b from-slate-800 to-slate-700 dark:from-gray-900 dark:to-gray-800 z-50 shadow-2xl">
                  <div className="flex flex-col h-full">
                    {/* Header du menu */}
                    <div className="p-4 border-b border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-orange-500">
                            {currentEmployee?.avatarBase64 || currentEmployee?.avatarUrl ? (
                              <img 
                                src={currentEmployee.avatarBase64 || currentEmployee.avatarUrl} 
                                alt={`${currentEmployee.firstName} ${currentEmployee.lastName}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-600">
                                <span className="text-white text-sm font-bold">
                                  {currentEmployee?.firstName?.[0]}{currentEmployee?.lastName?.[0]}
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-white font-medium text-sm">
                              {currentEmployee?.firstName} {currentEmployee?.lastName}
                            </div>
                            <div className="text-white/70 text-xs">
                              {currentEmployee?.role === 'admin' ? 'Administrateur' : 
                               currentEmployee?.role === 'manager' ? 'Manager' : 'Caissier'}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowMobileMenu(false)}
                          className="p-2 rounded-full hover:bg-white/10 transition-colors"
                        >
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {/* Menu items */}
                    <div className="flex-1 overflow-y-auto py-4">
                      <div className="space-y-1 px-3">
                        {/* Caisse */}
                        <button
                          onClick={() => {
                            handleViewChange('pos');
                            setShowMobileMenu(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                            activeView === 'pos' 
                              ? 'bg-orange-500 text-white shadow-lg' 
                              : 'text-white/90 hover:bg-white/10'
                          }`}
                        >
                          <ShoppingCart size={20} />
                          <span className="font-medium">Caisse</span>
                        </button>
                        
                        {/* Historique */}
                        {hasPermissionForView('history') && currentEmployee?.role !== 'cashier' && (
                          <button
                            onClick={() => {
                              handleViewChange('history');
                              setShowMobileMenu(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                              activeView === 'history' 
                                ? 'bg-orange-500 text-white shadow-lg' 
                                : 'text-white/90 hover:bg-white/10'
                            }`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2" />
                            </svg>
                            <span className="font-medium">Historique</span>
                          </button>
                        )}
                        
                        {/* Stock */}
                        {hasPermissionForView('stock') && currentEmployee?.role !== 'cashier' && (
                          <button
                            onClick={() => {
                              handleViewChange('stock');
                              setShowMobileMenu(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                              activeView === 'stock' 
                                ? 'bg-orange-500 text-white shadow-lg' 
                                : 'text-white/90 hover:bg-white/10'
                            }`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <span className="font-medium">Stock</span>
                          </button>
                        )}
                        
                        {/* Commandes */}
                        {hasPermissionForView('orders') && currentEmployee?.role !== 'cashier' && (
                          <button
                            onClick={() => {
                              handleViewChange('orders');
                              setShowMobileMenu(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                              activeView === 'orders' 
                                ? 'bg-orange-500 text-white shadow-lg' 
                                : 'text-white/90 hover:bg-white/10'
                            }`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                            <span className="font-medium">Commandes</span>
                          </button>
                        )}
                        
                        {/* Promotions */}
                        {hasPermissionForView('promotions') && currentEmployee?.role !== 'cashier' && (
                          <button
                            onClick={() => {
                              handleViewChange('promotions');
                              setShowMobileMenu(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                              activeView === 'promotions' 
                                ? 'bg-orange-500 text-white shadow-lg' 
                                : 'text-white/90 hover:bg-white/10'
                            }`}
                          >
                            <Tag size={20} />
                            <span className="font-medium">Promotions</span>
                          </button>
                        )}
                        
                        {/* Fidélité */}
                        {hasPermissionForView('loyalty') && (
                          <button
                            onClick={() => {
                              handleViewChange('loyalty');
                              setShowMobileMenu(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                              activeView === 'loyalty' 
                                ? 'bg-orange-500 text-white shadow-lg' 
                                : 'text-white/90 hover:bg-white/10'
                            }`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                            <span className="font-medium">Fidélité</span>
                          </button>
                        )}
                        
                        {/* Rapports */}
                        {hasPermissionForView('reports') && currentEmployee?.role !== 'cashier' && (
                          <button
                            onClick={() => {
                              handleViewChange('reports');
                              setShowMobileMenu(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                              activeView === 'reports' 
                                ? 'bg-orange-500 text-white shadow-lg' 
                                : 'text-white/90 hover:bg-white/10'
                            }`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="font-medium">Rapports</span>
                          </button>
                        )}
                        
                        {/* Employés */}
                        {(hasPermissionForView('employees') || currentEmployee?.role === 'cashier') && (
                          <button
                            onClick={() => {
                              handleViewChange('employees');
                              setShowMobileMenu(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                              activeView === 'employees' 
                                ? 'bg-orange-500 text-white shadow-lg' 
                                : 'text-white/90 hover:bg-white/10'
                            }`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                            </svg>
                            <span className="font-medium">Employés</span>
                          </button>
                        )}
                        
                        {/* Paramètres */}
                        {hasPermissionForView('settings') && currentEmployee?.role !== 'cashier' && (
                          <button
                            onClick={() => {
                              handleViewChange('settings');
                              setShowMobileMenu(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                              activeView === 'settings' 
                                ? 'bg-orange-500 text-white shadow-lg' 
                                : 'text-white/90 hover:bg-white/10'
                            }`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="font-medium">Paramètres</span>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Footer avec déconnexion */}
                    <div className="p-4 border-t border-white/10">
                      <button
                        onClick={() => {
                          setShowMobileMenu(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="font-medium">Déconnexion</span>
                      </button>
                    </div>
                  </div>
                </div>
            )}
          </div>
        ) : null}
        
        {/* Menu mobile sidebar - Déplacé en dehors de la condition POS pour être disponible sur toutes les pages */}
        {showMobileMenu && (
          <div className="fixed left-0 top-0 bottom-0 w-80 bg-gradient-to-b from-slate-800 to-slate-700 dark:from-gray-900 dark:to-gray-800 z-50 shadow-2xl">
            <div className="flex flex-col h-full">
              {/* Header du menu */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-orange-500">
                      {currentEmployee?.avatarBase64 || currentEmployee?.avatarUrl ? (
                        <img 
                          src={currentEmployee.avatarBase64 || currentEmployee.avatarUrl} 
                          alt={`${currentEmployee.firstName} ${currentEmployee.lastName}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-600">
                          <span className="text-white text-sm font-bold">
                            {currentEmployee?.firstName?.[0]}{currentEmployee?.lastName?.[0]}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-white font-medium text-sm">
                        {currentEmployee?.firstName} {currentEmployee?.lastName}
                      </div>
                      <div className="text-white/70 text-xs">
                        {currentEmployee?.role === 'admin' ? 'Administrateur' : 
                         currentEmployee?.role === 'manager' ? 'Manager' : 'Caissier'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMobileMenu(false)}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Menu items */}
              <div className="flex-1 overflow-y-auto py-4">
                <div className="space-y-1 px-3">
                  {/* Caisse */}
                  <button
                    onClick={() => {
                      handleViewChange('pos');
                      setShowMobileMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      activeView === 'pos' 
                        ? 'bg-orange-500 text-white shadow-lg' 
                        : 'text-white/90 hover:bg-white/10'
                    }`}
                  >
                    <ShoppingCart size={20} />
                    <span className="font-medium">Caisse</span>
                  </button>
                  
                  {/* Historique */}
                  {hasPermissionForView('history') && currentEmployee?.role !== 'cashier' && (
                    <button
                      onClick={() => {
                        handleViewChange('history');
                        setShowMobileMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        activeView === 'history' 
                          ? 'bg-orange-500 text-white shadow-lg' 
                          : 'text-white/90 hover:bg-white/10'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2" />
                      </svg>
                      <span className="font-medium">Historique</span>
                    </button>
                  )}
                  
                  {/* Stock */}
                  {hasPermissionForView('stock') && currentEmployee?.role !== 'cashier' && (
                    <button
                      onClick={() => {
                        handleViewChange('stock');
                        setShowMobileMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        activeView === 'stock' 
                          ? 'bg-orange-500 text-white shadow-lg' 
                          : 'text-white/90 hover:bg-white/10'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <span className="font-medium">Stock</span>
                    </button>
                  )}
                  
                  {/* Commandes */}
                  {hasPermissionForView('orders') && currentEmployee?.role !== 'cashier' && (
                    <button
                      onClick={() => {
                        handleViewChange('orders');
                        setShowMobileMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        activeView === 'orders' 
                          ? 'bg-orange-500 text-white shadow-lg' 
                          : 'text-white/90 hover:bg-white/10'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                      <span className="font-medium">Commandes</span>
                    </button>
                  )}
                  
                  {/* Promotions */}
                  {hasPermissionForView('promotions') && currentEmployee?.role !== 'cashier' && (
                    <button
                      onClick={() => {
                        handleViewChange('promotions');
                        setShowMobileMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        activeView === 'promotions' 
                          ? 'bg-orange-500 text-white shadow-lg' 
                          : 'text-white/90 hover:bg-white/10'
                      }`}
                    >
                      <Tag size={20} />
                      <span className="font-medium">Promotions</span>
                    </button>
                  )}
                  
                  {/* Fidélité */}
                  {hasPermissionForView('loyalty') && (
                    <button
                      onClick={() => {
                        handleViewChange('loyalty');
                        setShowMobileMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        activeView === 'loyalty' 
                          ? 'bg-orange-500 text-white shadow-lg' 
                          : 'text-white/90 hover:bg-white/10'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                      <span className="font-medium">Fidélité</span>
                    </button>
                  )}
                  
                  {/* Rapports */}
                  {hasPermissionForView('reports') && currentEmployee?.role !== 'cashier' && (
                    <button
                      onClick={() => {
                        handleViewChange('reports');
                        setShowMobileMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        activeView === 'reports' 
                          ? 'bg-orange-500 text-white shadow-lg' 
                          : 'text-white/90 hover:bg-white/10'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="font-medium">Rapports</span>
                    </button>
                  )}
                  
                  {/* Employés */}
                  {(hasPermissionForView('employees') || currentEmployee?.role === 'cashier') && (
                    <button
                      onClick={() => {
                        handleViewChange('employees');
                        setShowMobileMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        activeView === 'employees' 
                          ? 'bg-orange-500 text-white shadow-lg' 
                          : 'text-white/90 hover:bg-white/10'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                      <span className="font-medium">Employés</span>
                    </button>
                  )}
                  
                  {/* Paramètres */}
                  {hasPermissionForView('settings') && currentEmployee?.role !== 'cashier' && (
                    <button
                      onClick={() => {
                        handleViewChange('settings');
                        setShowMobileMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        activeView === 'settings' 
                          ? 'bg-orange-500 text-white shadow-lg' 
                          : 'text-white/90 hover:bg-white/10'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="font-medium">Paramètres</span>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Footer avec déconnexion */}
              <div className="p-4 border-t border-white/10">
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="font-medium">Déconnexion</span>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {activeView === 'history' ? (
          <div className="flex-1 overflow-auto content-background pt-16 md:pt-0" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
            <SalesHistoryFirebase 
              onViewReceipt={handleViewReceipt}
              searchQuery={historySearchQuery}
            />
          </div>
        ) : activeView === 'orders' ? (
          <div className="flex-1 overflow-auto content-background pt-16 md:pt-0" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
            <SupplierOrders 
              onCreateOrder={handleCreateOrder}
              hasPermission={(permission) => hasPermissionForView(permission)}
            />
          </div>
        ) : activeView === 'promotions' ? (
          <div className="flex-1 overflow-auto content-background pt-16 md:pt-0" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
            <PromotionsManager 
              products={products}
              onUpdateProduct={(productId: string, promotion: Promotion | undefined) => {
                handleUpdateProduct(productId, { promotion });
              }}
              hasPermission={(permission) => hasPermissionForView(permission)}
            />
          </div>
        ) : activeView === 'stock' ? (
          <div className="pt-16 md:pt-0 content-background" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
            <StockManager 
              products={products}
              onUpdateProduct={handleUpdateProduct}
              onShowMovementModal={setShowStockMovementModal}
              onShowHistoryModal={setShowStockHistoryModal}
              onAddProduct={handleAddProduct}
              onDeleteProduct={handleDeleteProduct}
              onDeleteMultipleProducts={handleDeleteMultipleProducts}
              categories={categories}
              onAddCategory={handleAddCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
              hasPermission={hasPermissionForView}
            />
          </div>
        ) : activeView === 'employees' ? (
          <div className="flex-1 overflow-auto content-background pt-16 md:pt-0" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
            <EmployeeManagerFirebase />
          </div>
        ) : activeView === 'reports' ? (
          <div className="flex-1 overflow-auto content-background pt-16 md:pt-0" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
            <Reports
              employees={demoEmployees}
            />
          </div>
        ) : activeView === 'settings' ? (
          <div className="flex-1 overflow-auto content-background pt-16 md:pt-0" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
            <Settings
              onSave={(settings) => {
                console.log('Paramètres enregistrés:', settings);
                // Mettre à jour l'état des paramètres de l'application
                setAppSettings(settings);
              }}
            />
          </div>
        ) : activeView === 'loyalty' ? (
          <div className="flex-1 overflow-auto content-background pt-16 md:pt-0" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
            <LoyaltyManager
              loyaltyCards={loyaltyCards}
              loyaltyTiers={loyaltyTiers}
              onCreateCard={handleCreateLoyaltyCard}
              onUpdateCard={handleUpdateLoyaltyCard}
              onDeleteCard={handleDeleteLoyaltyCard}
              onUpdateLoyaltyTier={handleUpdateLoyaltyTier}
              hasPermission={(permission) => hasPermissionForView(permission)}
            />
          </div>
        ) : activeView === 'qrcodes' ? (
          <div className="flex-1 overflow-auto print-container content-background pt-16 md:pt-0" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
            <QRCodeGenerator
              products={products}
            />
          </div>
        ) : null}

        {showPaymentModal && (
          <PaymentModal
            total={cartItems.reduce(
              (sum, item) => sum + calculatePromotionalPrice(item.product, item.quantity),
              0
            )}
            onClose={() => {
              // Fermer le modal de paiement avec un effet de nettoyage
              setShowPaymentModal(false);
            }}
            onPaymentComplete={handlePaymentComplete}
            onShowLoyaltyCard={() => {
              // Ouvrir le modal de carte de fidélité sans fermer le modal de paiement
              setShowLoyaltyCardModal(true);
            }}
            selectedLoyaltyCard={selectedLoyaltyCard}
            loyaltyDiscount={getLoyaltyDiscount(selectedLoyaltyCard)}
          />
        )}

        {showReceipt && (
          <Receipt
            receipt={showReceipt}
            onClose={() => {
              // Fermer le reçu et s'assurer que tous les autres modals sont fermés
              setShowReceipt(null);
              setShowPaymentModal(false);
              setShowLoyaltyCardModal(false);
            }}
          />
        )}

        {showStockAlert && (
          <StockAlert
            products={products}
            onClose={() => setShowStockAlert(false)}
          />
        )}

        {showStockMovementModal && (
          <StockMovementModal
            product={showStockMovementModal}
            onClose={() => setShowStockMovementModal(null)}
            onSubmit={handleStockAdjustment}
          />
        )}

        {showStockHistoryModal && (
          <StockHistoryModal
            product={showStockHistoryModal}
            movements={stockMovements.filter(m => m.productId === showStockHistoryModal.id)}
            onClose={() => setShowStockHistoryModal(null)}
          />
        )}

        {showSupplierOrderModal && (
          <SupplierOrderModal
            products={products}
            onClose={() => {
              setShowSupplierOrderModal(false);
              setEditOrderId(null);
            }}
            onOrderSubmit={(order) => {
              console.log(editOrderId 
                ? `Commande ${order.id} modifiée avec succès` 
                : 'Commande créée avec succès:', 
              order);
              setShowSupplierOrderModal(false);
              setEditOrderId(null);
              
              // Rafraîchir la liste des commandes de manière plus fiable
              if (activeView === 'orders') {
                // Forcer un rerendering complet du composant
                setActiveView('promotions');
                // Petit délai pour permettre le démontage/remontage
                setTimeout(() => {
                  setActiveView('orders');
                }, 10);
              }
            }}
            businessId={currentEmployee?.businessId || 'business1'}
            existingOrderId={editOrderId || undefined}
            isEditMode={!!editOrderId}
          />
        )}
      </div>
    </AppContext.Provider>
  );
}

export default App;