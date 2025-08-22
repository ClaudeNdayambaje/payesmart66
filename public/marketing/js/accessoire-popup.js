/**
 * Script de gestion des popups détaillés pour accessoires
 * PayeSmart - Module Accessoires
 */

document.addEventListener('DOMContentLoaded', function() {
    // Création de la structure HTML du popup
    createPopupStructure();
    
    // Initialiser les événements sur les cartes d'accessoires
    initAccessoireCards();
});

/**
 * Crée la structure HTML du popup et l'ajoute au body
 */
function createPopupStructure() {
    const popupHTML = `
    <div class="accessoire-popup-overlay" id="accessoire-popup-overlay">
        <div class="accessoire-popup">
            <div class="accessoire-popup-header">
                <h2 id="accessoire-popup-title">Détails de l'accessoire</h2>
                <button class="accessoire-popup-close-x" id="accessoire-popup-close-x">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="accessoire-popup-content">
                <div class="accessoire-popup-image">
                    <img src="" alt="Image de l'accessoire" id="accessoire-popup-img">
                </div>
                <div class="accessoire-popup-details">
                    <span class="accessoire-popup-category" id="accessoire-popup-category">Catégorie</span>
                    
                    <div class="accessoire-popup-description">
                        <h3>Description du produit</h3>
                        <p id="accessoire-popup-description">Description détaillée de l'accessoire</p>
                    </div>
                    
                    <div class="accessoire-popup-specs">
                        <h3>Caractéristiques</h3>
                        <ul id="accessoire-popup-specs">
                            <li>Caractéristique 1</li>
                            <li>Caractéristique 2</li>
                            <li>Caractéristique 3</li>
                        </ul>
                    </div>
                    
                    <div class="accessoire-popup-actions">
                        <div class="accessoire-popup-price" id="accessoire-popup-price">0.00 €</div>
                        <div class="accessoire-popup-buttons">
                            <button class="accessoire-popup-add-to-cart" id="accessoire-popup-add-to-cart">
                                <i class="fas fa-shopping-cart"></i> Ajouter au panier
                            </button>
                            <button class="accessoire-popup-close" id="accessoire-popup-close">
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', popupHTML);
    
    // Ajouter les événements de fermeture
    document.getElementById('accessoire-popup-close-x').addEventListener('click', closePopup);
    document.getElementById('accessoire-popup-close').addEventListener('click', closePopup);
    document.getElementById('accessoire-popup-overlay').addEventListener('click', function(e) {
        if (e.target === this) closePopup();
    });
    
    // Ajouter l'événement d'ajout au panier
    document.getElementById('accessoire-popup-add-to-cart').addEventListener('click', function() {
        const accessoireId = this.getAttribute('data-id');
        addToCart(accessoireId);
        closePopup();
    });
}

/**
 * Initialise les événements sur les cartes d'accessoires
 */
function initAccessoireCards() {
    // Sélectionner toutes les cartes d'accessoires
    const accessoireCards = document.querySelectorAll('.accessoire-card, .hardware-card');
    
    // Ajouter un événement de clic sur chaque carte
    accessoireCards.forEach(card => {
        card.addEventListener('click', function(event) {
            // Éviter le déclenchement sur clic de bouton
            if (event.target.classList.contains('btn-primary') || 
                event.target.classList.contains('add-to-cart-btn') || 
                event.target.closest('.btn-primary') || 
                event.target.closest('.add-to-cart-btn')) {
                return;
            }
            
            const accessoireId = this.getAttribute('data-id') || '';
            const accessoireNom = this.querySelector('.accessoire-nom') ? 
                                this.querySelector('.accessoire-nom').textContent : 
                                this.querySelector('.hardware-name').textContent;
            
            const accessoireImg = this.querySelector('.accessoire-image img') ? 
                                this.querySelector('.accessoire-image img').src : 
                                this.querySelector('.hardware-image img').src;
            
            const accessoirePrice = this.querySelector('.accessoire-prix') ? 
                                  this.querySelector('.accessoire-prix').textContent : 
                                  this.querySelector('.hardware-price').textContent;
            
            const accessoireDesc = this.querySelector('.accessoire-description') ? 
                                 this.querySelector('.accessoire-description').textContent : 
                                 'Accessoire premium pour optimiser votre solution PayeSmart.';
            
            // Identifier la catégorie à partir des classes ou d'un attribut
            let category = 'Hardware';
            if (this.classList.contains('orange-gradient')) category = 'Terminal';
            if (this.classList.contains('blue-gradient')) category = 'Imprimante';
            if (this.classList.contains('purple-gradient')) category = 'Scanner';
            if (this.classList.contains('green-gradient')) category = 'Alimentation';
            if (this.classList.contains('teal-gradient')) category = 'Connectivité';
            
            // Générer quelques specs basées sur la catégorie
            const specs = generateSpecs(category);
            
            // Ouvrir le popup avec les détails
            openPopup({
                id: accessoireId,
                name: accessoireNom,
                image: accessoireImg,
                price: accessoirePrice,
                description: accessoireDesc,
                category: category,
                specs: specs
            });
        });
    });
}

/**
 * Génère des caractéristiques techniques basées sur la catégorie
 */
function generateSpecs(category) {
    const specsMap = {
        'Terminal': [
            'Écran tactile haute définition',
            'Certification PCI-DSS',
            'Connectivité WiFi et Bluetooth',
            'Batterie longue durée (8-12 heures)'
        ],
        'Imprimante': [
            'Impression thermique rapide',
            'Connectivité USB et réseau',
            'Compatible avec les rouleaux standard',
            'Dimensions compactes pour gain de place'
        ],
        'Scanner': [
            'Lecture 1D et 2D instantanée',
            'Compatible avec tous les codes-barres',
            'Design ergonomique',
            'Connection sans fil sécurisée'
        ],
        'Alimentation': [
            'Protection contre les surtensions',
            'Entrée universelle 100-240V',
            'Efficacité énergétique certifiée',
            'Câble renforcé anti-usure'
        ],
        'Connectivité': [
            'Technologie WiFi Dual Band',
            'Sécurité WPA3 Enterprise',
            'Portée optimisée jusqu\'à 30 mètres',
            'Configuration simplifiée via QR code'
        ],
        'Hardware': [
            'Conçu pour une utilisation professionnelle intensive',
            'Garantie 2 ans incluse',
            'Assistance technique dédiée',
            'Compatibilité totale avec PayeSmart'
        ]
    };
    
    return specsMap[category] || specsMap['Hardware'];
}

/**
 * Ouvre le popup avec les détails de l'accessoire
 */
function openPopup(accessoire) {
    // Remplir les détails
    document.getElementById('accessoire-popup-title').textContent = accessoire.name;
    document.getElementById('accessoire-popup-img').src = accessoire.image;
    document.getElementById('accessoire-popup-img').alt = accessoire.name;
    document.getElementById('accessoire-popup-category').textContent = accessoire.category;
    document.getElementById('accessoire-popup-description').textContent = accessoire.description;
    document.getElementById('accessoire-popup-price').textContent = accessoire.price;
    
    // Remplir les specs
    const specsList = document.getElementById('accessoire-popup-specs');
    specsList.innerHTML = '';
    accessoire.specs.forEach(spec => {
        const li = document.createElement('li');
        li.textContent = spec;
        specsList.appendChild(li);
    });
    
    // Stocker l'ID pour l'ajout au panier
    document.getElementById('accessoire-popup-add-to-cart').setAttribute('data-id', accessoire.id);
    
    // Afficher le popup
    const overlay = document.getElementById('accessoire-popup-overlay');
    overlay.classList.add('active');
    
    // Désactiver le scroll du body
    document.body.style.overflow = 'hidden';
}

/**
 * Ferme le popup
 */
function closePopup() {
    const overlay = document.getElementById('accessoire-popup-overlay');
    overlay.classList.remove('active');
    
    // Réactiver le scroll du body
    document.body.style.overflow = '';
}

/**
 * Ajoute l'accessoire au panier
 * Cette fonction peut être adaptée pour utiliser le système existant d'ajout au panier
 */
function addToCart(accessoireId) {
    // Récupérer la fonction d'ajout au panier existante
    if (window.addToCart) {
        window.addToCart(accessoireId);
    } else {
        console.log('Produit ajouté au panier:', accessoireId);
        // Animation de confirmation
        showAddToCartConfirmation();
    }
}

/**
 * Affiche une confirmation visuelle d'ajout au panier
 */
function showAddToCartConfirmation() {
    const confirmation = document.createElement('div');
    confirmation.className = 'cart-confirmation';
    confirmation.innerHTML = '<i class="fas fa-check"></i> Produit ajouté au panier';
    
    document.body.appendChild(confirmation);
    
    setTimeout(() => {
        confirmation.classList.add('show');
        
        setTimeout(() => {
            confirmation.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(confirmation);
            }, 300);
        }, 2000);
    }, 10);
}

// Ajouter la fonction au contexte global pour permettre son utilisation dans d'autres scripts
window.openAccessoirePopup = openPopup;
