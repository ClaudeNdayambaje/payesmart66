import React, { useState, useEffect } from 'react';
import { CartItem, Product } from '../types';
import { Trash2, ShoppingCart, ChevronDown, ChevronUp, Tag, AlertCircle, Sun, Moon } from 'lucide-react';

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
  calculatePromotionalPrice: (product: Product, quantity: number) => number;
}

const Cart: React.FC<CartProps> = ({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  calculatePromotionalPrice,
}) => {
  // Gérer le thème sombre avec un état local
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Vérifier le mode sombre au chargement initial et configurer un observateur
  useEffect(() => {
    // Fonction pour mettre à jour l'état en fonction de la classe 'dark'
    const updateThemeState = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };
    
    // Initialisation
    updateThemeState();
    
    // Observer les changements d'attribut sur l'élément html
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateThemeState();
        }
      });
    });
    
    // Configurer l'observateur
    observer.observe(document.documentElement, { attributes: true });
    
    // Écouter les changements de localStorage pour la synchronisation multi-onglets
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme') {
        updateThemeState();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Nettoyage à la désactivation du composant
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  // Fonction pour basculer manuellement le mode sombre
  const toggleDarkMode = () => {
    try {
      // Obtenir l'élément html
      const html = document.documentElement;
      
      // Basculer la classe dark
      if (html.classList.contains('dark')) {
        // Passer en mode clair
        console.log('Basculement vers mode clair');
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      } else {
        // Passer en mode sombre
        console.log('Basculement vers mode sombre');
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      }
      
      // Forcer une mise à jour immédiate de l'état local
      setIsDarkMode(!isDarkMode);
      
      // Déclencher un événement personnalisé pour informer les autres composants
      window.dispatchEvent(new CustomEvent('themeChange', { 
        detail: { isDark: !isDarkMode } 
      }));
      
      console.log('Basculement du thème réussi');
    } catch (error) {
      console.error('Erreur lors du basculement du thème:', error);
    }
  };
  const total = items.reduce(
    (sum, item) => sum + calculatePromotionalPrice(item.product, item.quantity),
    0
  );

  const hasLowStock = items.some(
    item => item.quantity > item.product.stock
  );



  return (
    <div className="bg-[color:var(--color-card-bg)] h-full flex flex-col overflow-hidden border dark:border-gray-700">
      <div className="p-2 sm:p-3 border-b dark:border-gray-700 bg-[color:var(--color-secondary-alt)] flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-[color:var(--color-secondary-alt)] p-1.5 rounded-md">
            <ShoppingCart className="text-[color:var(--color-text)]" size={20} />
          </div>
          <h2 className="text-sm sm:text-base font-semibold text-[color:var(--color-text)]">
            <span className="hidden sm:inline">Panier en cours</span>
            <span className="sm:hidden">Panier</span>
            {items.length > 0 && (
              <span className="ml-2 text-xs bg-[color:var(--color-background-alt)] text-[color:var(--color-text)] px-1.5 py-0.5 rounded-full">
                {items.length}
              </span>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Bouton mode jour/nuit simplifié et fiable */}
          <button
            onClick={() => {
              console.log('Bouton de basculement de thème cliqué!');
              toggleDarkMode();
            }}
            className="flex items-center justify-center bg-gray-200 dark:bg-gray-700 p-1.5 sm:p-2 rounded-full text-gray-800 dark:text-yellow-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            title={isDarkMode ? 'Passer en mode jour' : 'Passer en mode nuit'}
            aria-label={isDarkMode ? 'Passer en mode jour' : 'Passer en mode nuit'}
            type="button"
          >
            {/* En mode jour, afficher une lune; en mode nuit, afficher un soleil */}
            {!isDarkMode ? <Moon size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Sun size={16} className="sm:w-[18px] sm:h-[18px]" />}
          </button>
          {items.length > 0 && (
            <span className="text-[color:var(--color-text)] font-medium text-xs sm:text-sm">
              {total.toFixed(2)} €
            </span>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-1 sm:p-2 transition-all duration-300 max-h-full opacity-100">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-[color:var(--color-text-secondary)]">
            <ShoppingCart size={48} className="mb-4 opacity-50" />
            <p className="text-center">Votre panier est vide</p>
          </div>
        ) : (
          <div className="space-y-1 sm:space-y-2">
            {items.map((item) => {
              const hasPromotion = item.product.promotion !== undefined;
              const isLowStock = item.quantity > item.product.stock;
              const regularPrice = item.product.price * item.quantity;
              const promotionalPrice = calculatePromotionalPrice(item.product, item.quantity);
              const discount = regularPrice - promotionalPrice;
              
              return (
                <div 
                  key={item.product.id} 
                  className={`bg-[color:var(--color-background-alt)] rounded-lg p-1.5 sm:p-2 ${
                    isLowStock ? 'border-l-4 border-[color:var(--color-error)]' : ''
                  }`}
                >
                  <div className="flex items-start gap-1.5 sm:gap-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-md overflow-hidden bg-[color:var(--color-background-alt)] flex-shrink-0">
                      {item.product.image ? (
                        <img 
                          src={item.product.image} 
                          alt={item.product.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[color:var(--color-background-alt)]">
                          <Tag className="text-[color:var(--color-text-secondary)]" size={20} />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col">
                        <h3 className="text-xs sm:text-sm font-medium text-[color:var(--color-text)] truncate mb-1">
                          {item.product.name}
                        </h3>
                        <div className="flex flex-col text-xs text-[color:var(--color-text-secondary)]">
                          <span className="hidden sm:inline">Prix unitaire : {item.product.price.toFixed(2)} €</span>
                          <span className="sm:hidden">{item.product.price.toFixed(2)} € × {item.quantity}</span>
                          <span className="hidden sm:inline">Quantité : {item.quantity}</span>
                        </div>
                      </div>
                      
                      {hasPromotion && discount > 0 && (
                        <div className="flex items-center gap-1 text-xs text-[color:var(--color-success)] dark:text-[color:var(--color-success)] mt-1">
                          <Tag size={12} />
                          <span>Économie: {discount.toFixed(2)} €</span>
                        </div>
                      )}
                      
                      {isLowStock && (
                        <div className="flex items-center gap-1 text-xs text-[color:var(--color-error)] dark:text-[color:var(--color-error)] mt-1">
                          <AlertCircle size={12} />
                          <span>Stock insuffisant ({item.product.stock} disponible)</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-1.5 sm:mt-2 gap-1 sm:gap-2">
                    <div className="flex items-center gap-0.5 sm:gap-1">
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="p-0.5 sm:p-1 rounded bg-[color:var(--color-background-alt)] text-[color:var(--color-text)] disabled:opacity-50"
                      >
                        <ChevronDown size={14} className="sm:w-4 sm:h-4" />
                      </button>
                      <span className="w-6 sm:w-8 text-center text-xs sm:text-sm">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                        className="p-0.5 sm:p-1 rounded bg-[color:var(--color-background-alt)] text-[color:var(--color-text)]"
                      >
                        <ChevronUp size={14} className="sm:w-4 sm:h-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="font-medium text-xs sm:text-sm text-[color:var(--color-text)] dark:text-[#f6941c]">
                        {promotionalPrice.toFixed(2)} €
                      </span>
                      <button
                        onClick={() => onRemoveItem(item.product.id)}
                        className="p-1 sm:p-1.5 rounded-full hover:bg-[color:var(--color-error)]/30 text-[color:var(--color-error)]"
                      >
                        <Trash2 size={14} className="sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <div className="p-2 sm:p-3 border-t border-[color:var(--color-border)]">
        <div className="flex justify-between items-center mb-2 sm:mb-3">
          <span className="text-[color:var(--color-text-secondary)] font-medium text-sm sm:text-base">Total</span>
          <span className="text-lg sm:text-xl font-bold text-[color:var(--color-text)] dark:text-[#f6941c]">
            {total.toFixed(2)} €
          </span>
        </div>
        
        <div className="flex flex-col gap-2 justify-center">
          <button
            onClick={onCheckout}
            disabled={items.length === 0 || hasLowStock}
            className="flex items-center justify-center gap-2 sm:gap-3 bg-[color:var(--color-primary)] hover:bg-opacity-80 py-3 sm:py-4 px-4 sm:px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
          >
            <ShoppingCart size={20} className="sm:w-[26px] sm:h-[26px] text-[color:var(--color-sidebar-icon)]" />
            <span className="text-sm sm:text-lg font-medium text-[color:var(--color-sidebar-icon)]">
              <span className="hidden sm:inline">Finaliser la vente</span>
              <span className="sm:hidden">Finaliser</span>
            </span>
          </button>
        </div>
        
        {hasLowStock && (
          <div className="mt-2 text-center text-xs text-[color:var(--color-error)] bg-[color:var(--color-error)]/20 p-2 rounded-md flex items-center justify-center gap-1">
            <AlertCircle size={12} className="sm:w-[14px] sm:h-[14px]" />
            <span className="hidden sm:inline">Stock insuffisant. Veuillez ajuster les quantités.</span>
            <span className="sm:hidden">Stock insuffisant</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;