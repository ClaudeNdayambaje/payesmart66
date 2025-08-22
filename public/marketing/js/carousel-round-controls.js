/**
 * Script pour modifier les indicateurs du carrousel en ronds avec bouton pause/lecture
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log("Initialisation des contrôles ronds du carrousel");
    
    // Exécution immédiate pour garantir que notre script prenne le contrôle en premier
    // REMARQUE: Délai réduit car hero-indicators-fix.js est maintenant désactivé
    
    // Ajouter les styles CSS pour les indicateurs plus épais et responsive
    function addCustomStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            /* Styles pour les indicateurs du carrousel */
            .carousel-indicators {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 15px;
                margin-top: 20px;
                flex-wrap: nowrap; /* Toujours sur une ligne */
                padding: 10px 15px;
                overflow-x: auto; /* Permet le défilement horizontal si nécessaire */
                -webkit-overflow-scrolling: touch; /* Défilement fluide sur iOS */
                scrollbar-width: none; /* Masquer la barre de défilement sur Firefox */
                -ms-overflow-style: none; /* Masquer la barre de défilement sur IE/Edge */
                max-width: 100%;
                position: relative;
                z-index: 10;
            }
            
            /* Masquer la barre de défilement sur Chrome/Safari */
            .carousel-indicators::-webkit-scrollbar {
                display: none;
            }
            
            .carousel-indicator {
                height: 8px; /* Plus épais qu'avant */
                width: 45px;
                background-color: #fff; /* Couleur solide au lieu de transparente */
                opacity: 0.5; /* Utiliser l'opacité au lieu de la transparence */
                border-radius: 4px;
                transition: all 0.3s ease;
                cursor: pointer;
                position: relative;
                overflow: hidden;
                flex-shrink: 0; /* Empêche le rétrécissement des indicateurs */
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2); /* Ombre subtile pour effet moderne */
            }
            
            /* État actif des indicateurs */
            .carousel-indicator.active {
                opacity: 1;
                transform: scaleY(1.2); /* Léger agrandissement vertical */
                box-shadow: 0 2px 8px rgba(255, 255, 255, 0.5);
            }
            
            /* Animation pour l'indicateur qui devient actif */
            .carousel-indicator.becoming-active::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                width: 100%;
                background-color: #fff;
                animation: fillIndicator 0.5s ease forwards;
            }
            
            @keyframes fillIndicator {
                0% { width: 0; }
                100% { width: 100%; }
            }
            
            /* Bouton play/pause */
            .carousel-play-pause {
                width: 20px;
                height: 20px;
                border: 2px solid white;
                border-radius: 50%;
                position: relative;
                cursor: pointer;
                margin-left: 20px;
                flex-shrink: 0; /* Empêche le rétrécissement */
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2); /* Ombre pour effet 3D */
            }
            
            .carousel-play-pause::before {
                content: '';
                position: absolute;
                top: 5px;
                left: 7px;
                width: 0;
                height: 0;
                border-style: solid;
                border-width: 5px 0 5px 8px;
                border-color: transparent transparent transparent white;
            }
            
            .carousel-play-pause.paused::before {
                border: none;
                width: 3px;
                height: 8px;
                top: 5px;
                left: 6px;
                background: white;
                box-shadow: 5px 0 0 white;
            }
            
            /* Styles responsives pour mobile */
            @media (max-width: 768px) {
                .carousel-indicators {
                    gap: 12px;
                    padding: 8px 12px;
                }
                
                .carousel-indicator {
                    height: 7px;
                    width: 35px;
                }
            }
            
            @media (max-width: 480px) {
                .carousel-indicators {
                    gap: 10px;
                    padding: 6px 10px;
                }
                
                .carousel-indicator {
                    width: 30px;
                }
            }
        `;
        document.head.appendChild(styleElement);
        console.log('Styles personnalisés pour les indicateurs du carrousel ajoutés');
    }
    
    // Ajouter les styles dès le début
    addCustomStyles();
    
    setTimeout(function() {
        // Récupérer le conteneur des indicateurs
        const indicatorsContainer = document.querySelector('.carousel-indicators');
        
        // Assurer que les indicateurs s'initialisent correctement au chargement
        function initActiveIndicator() {
            console.log('Initialisation des indicateurs du carrousel');
            const indicators = document.querySelectorAll('.carousel-indicator');
            const activeIndicator = document.querySelector('.carousel-indicator.active');
            
            // Forcer l'initialisation, même si un indicateur est déjà actif
            // pour garantir que l'animation se déclenche
            let activeIndex = 0;
            
            // Si une diapositive est active, utiliser son index
            if (window.currentSlide !== undefined) {
                activeIndex = window.currentSlide;
            }
            
            // Supprimer toute classe active existante
            indicators.forEach(ind => {
                ind.classList.remove('active');
                ind.classList.remove('becoming-active');
            });
            
            // Appliquer les classes pour déclencher l'animation
            if (indicators.length > activeIndex) {
                console.log('Animation de l\'indicateur initial:', activeIndex);
                indicators[activeIndex].classList.add('active');
                indicators[activeIndex].classList.add('becoming-active');
                
                setTimeout(() => {
                    indicators[activeIndex].classList.remove('becoming-active');
                }, 500);
            }
        }
        
        // Initialiser le premier indicateur immédiatement + avec un court délai pour garantir l'animation
        initActiveIndicator(); // Exécution immédiate
        setTimeout(initActiveIndicator, 100); // Ré-exécution rapide pour garantir l'application
        
        // Vérifier et synchroniser les indicateurs périodiquement avec le slide actif
        function synchronizeIndicators() {
            // Essayer de trouver l'index du slide actif directement depuis la fonction goToSlide
            if (window.currentSlide !== undefined) {
                const activeIndex = window.currentSlide;
                const indicators = document.querySelectorAll('.carousel-indicator');
                const activeIndicator = document.querySelector('.carousel-indicator.active');
                
                // Si l'indicateur actif ne correspond pas au slide actif, corriger
                if (activeIndicator !== indicators[activeIndex]) {
                    console.log('Resynchronisation des indicateurs avec slide actif:', activeIndex);
                    animateIndicators(activeIndex);
                }
            }
        }
        
        // Synchroniser plus fréquemment pour s'assurer que les indicateurs correspondent aux slides
        // sans rater une transition automatique (l'intervalle standard entre les slides étant de 5 secondes)
        setInterval(synchronizeIndicators, 1000);
        
        if (!indicatorsContainer) {
            console.error("Le conteneur des indicateurs n'a pas été trouvé");
            return;
        }
        
        // Ajouter un bouton pause/lecture à la fin des indicateurs
        const playPauseButton = document.createElement('div');
        playPauseButton.className = 'carousel-play-pause';
        playPauseButton.setAttribute('role', 'button');
        playPauseButton.setAttribute('aria-label', 'Pause');
        playPauseButton.setAttribute('tabindex', '0');
        
        // Variable pour suivre l'état du carrousel
        let isPlaying = true;
        
        // Fonction pour mettre en pause le carrousel
        function pauseCarousel() {
            if (typeof pauseSlideshow === 'function') {
                pauseSlideshow();
            } else {
                // Utiliser l'événement customisé si la fonction n'est pas accessible directement
                document.dispatchEvent(new CustomEvent('carouselPause'));
            }
            
            playPauseButton.classList.add('paused');
            playPauseButton.setAttribute('aria-label', 'Lecture');
            isPlaying = false;
            
            console.log('Carrousel mis en pause');
        }
        
        // Fonction pour redémarrer le carrousel
        function playCarousel() {
            if (typeof resumeSlideshow === 'function') {
                resumeSlideshow();
            } else {
                // Utiliser l'événement customisé si la fonction n'est pas accessible directement
                document.dispatchEvent(new CustomEvent('carouselResume'));
            }
            
            playPauseButton.classList.remove('paused');
            playPauseButton.setAttribute('aria-label', 'Pause');
            isPlaying = true;
            
            console.log('Carrousel redémarré');
        }
        
        // Ajouter l'événement de clic pour le bouton pause/lecture
        playPauseButton.addEventListener('click', function() {
            if (isPlaying) {
                pauseCarousel();
            } else {
                playCarousel();
            }
        });
        
        // Ajouter le bouton au conteneur des indicateurs
        indicatorsContainer.appendChild(playPauseButton);
        
        // Assurer que la fonction goToSlide est accessible
        if (typeof window.goToSlide !== 'function') {
            console.log("La fonction goToSlide n'est pas accessible directement, création d'un intermédiaire");
            
            // Remplacer les événements de clic des indicateurs pour assurer qu'ils fonctionnent
            const indicators = document.querySelectorAll('.carousel-indicator');
            indicators.forEach((indicator, index) => {
                // Supprimer les événements existants pour éviter les duplications
                const newIndicator = indicator.cloneNode(true);
                indicator.parentNode.replaceChild(newIndicator, indicator);
                
                // Ajouter un nouvel événement de clic
                newIndicator.addEventListener('click', function(e) {
                    e.preventDefault();
                    
                    // Ajouter une classe temporaire pour l'animation
                    this.classList.add('clicked');
                    setTimeout(() => {
                        this.classList.remove('clicked');
                    }, 400);
                    
                    // Mettre à jour visuellement les indicateurs avec animation
                    const currentActive = document.querySelector('.carousel-indicator.active');
                    if (currentActive && currentActive !== this) {
                        // Animation de sortie pour l'indicateur actuellement actif
                        currentActive.classList.remove('active');
                        currentActive.classList.add('becoming-inactive');
                        setTimeout(() => {
                            currentActive.classList.remove('becoming-inactive');
                        }, 500); // Correspond à la durée de l'animation
                    }
                    
                    // Animation d'entrée pour le nouvel indicateur actif
                    this.classList.add('becoming-active');
                    this.classList.add('active');
                    setTimeout(() => {
                        this.classList.remove('becoming-active');
                    }, 500); // Correspond à la durée de l'animation
                    
                    // Déclencher un événement pour changer de slide
                    document.dispatchEvent(new CustomEvent('slideChange', {
                        detail: { slideIndex: index }
                    }));
                    
                    console.log("Clic sur l'indicateur", index);
                });
            });
        }
        
        // Écouter les événements de carrousel pour synchroniser l'état du bouton
        document.addEventListener('carouselPause', function() {
            playPauseButton.classList.add('paused');
            isPlaying = false;
        });
        
        document.addEventListener('carouselResume', function() {
            playPauseButton.classList.remove('paused');
            isPlaying = true;
        });
        
        // Créer une fonction d'animation des indicateurs - Version optimisée
        function animateIndicators(newIndex) {
            console.log('Animation des indicateurs vers l\'index:', newIndex);
            const indicators = document.querySelectorAll('.carousel-indicator');
            
            if (indicators.length <= newIndex || newIndex < 0) {
                console.error("Index d'indicateur invalide", newIndex, 'sur', indicators.length);
                return;
            }
            
            // Forcer le reflow/repaint pour s'assurer que les animations CSS s'appliquent correctement
            // même lors des transitions automatiques rapides
            document.querySelector('.carousel-indicators').offsetHeight;
            
            // D'abord supprimer toutes les classes d'animation précédentes
            // et identifier l'indicateur actuellement actif
            let currentActive = null;
            indicators.forEach((ind, idx) => {
                if (ind.classList.contains('active') && idx !== newIndex) {
                    currentActive = ind;
                }
                ind.classList.remove('becoming-active');
                ind.classList.remove('becoming-inactive');
            });
            
            // Animation de sortie pour l'ancien indicateur s'il existe et est différent
            if (currentActive) {
                currentActive.classList.remove('active');
                currentActive.classList.add('becoming-inactive');
                
                // Nettoyer après l'animation
                setTimeout(() => {
                    currentActive.classList.remove('becoming-inactive');
                }, 500);
            }
            
            // Animation d'entrée pour le nouvel indicateur
            const newIndicator = indicators[newIndex];
            if (!newIndicator.classList.contains('active')) {
                newIndicator.classList.add('active');
                newIndicator.classList.add('becoming-active');
                
                // Forcer un nouveau cycle de rendu pour garantir l'animation
                newIndicator.offsetHeight;
                
                // Nettoyer après l'animation
                setTimeout(() => {
                    newIndicator.classList.remove('becoming-active');
                }, 500);
            }
            
            // Mettre à jour la variable globale pour la synchronisation
            if (window.currentSlide !== newIndex) {
                window.currentSlide = newIndex;
            }
        }
        
        // Écouter directement les changements de slide en interceptant la fonction goToSlide
        if (typeof window.goToSlide === 'function') {
            console.log('Fonction goToSlide trouvée, ajout de l\'intercepteur');
            
            // Sauvegarder la fonction originale
            const originalGoToSlide = window.goToSlide;
            
            // Remplacer par notre version qui intercepte les transitions
            window.goToSlide = function(index) {
                console.log('Transition interceptée vers slide:', index);
                
                // Animer les indicateurs immédiatement pour éviter le décalage
                animateIndicators(index);
                
                // Appeler la fonction originale pour changer le slide
                originalGoToSlide(index);
            };
            
            console.log('Intercepteur de transitions installé');
        } else {
            console.error("Fonction goToSlide non disponible, utilisation de l'observateur de DOM");
            
            // Créer un observateur pour les changements d'indicateurs actifs
            // car on ne peut pas intercepter directement la fonction goToSlide
            const indicators = document.querySelectorAll('.carousel-indicator');
            indicators.forEach((indicator, index) => {
                // Observer les changements de classe active sur les indicateurs
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.attributeName === 'class' && indicator.classList.contains('active')) {
                            console.log('Indicateur actif détecté par observation:', index);
                            animateIndicators(index);
                        }
                    });
                });
                
                observer.observe(indicator, { attributes: true, attributeFilter: ['class'] });
            });
            
            // Également écouter les changements dans la div hero-background
            const heroBackground = document.querySelector('.hero-background');
            if (heroBackground) {
                heroBackground.addEventListener('transitionend', function() {
                    // Trouver quel indicateur est actif
                    const activeIndicator = document.querySelector('.carousel-indicator.active');
                    if (activeIndicator) {
                        const indicators = Array.from(document.querySelectorAll('.carousel-indicator'));
                        const activeIndex = indicators.indexOf(activeIndicator);
                        if (activeIndex >= 0) {
                            console.log('Transition détectée par transitionend, slide:', activeIndex);
                            animateIndicators(activeIndex);
                        }
                    }
                });
            }
        }
        
        // Écouter les événements slideChange pour les transitions manuelles
        document.addEventListener('slideChange', function(event) {
            if (event && event.detail && typeof event.detail.slideIndex === 'number') {
                console.log('Transition détectée par événement slideChange, slide:', event.detail.slideIndex);
                animateIndicators(event.detail.slideIndex);
            }
        });
        
        // Écouter les événements beforeAutoSlideChange pour les transitions automatiques
        document.addEventListener('beforeAutoSlideChange', function(event) {
            if (event && event.detail && typeof event.detail.slideIndex === 'number') {
                console.log('Transition automatique détectée, slide:', event.detail.slideIndex);
                
                // Utiliser un timeout court pour s'assurer que l'animation est bien appliquée
                // après que le DOM a été mis à jour
                setTimeout(() => {
                    animateIndicators(event.detail.slideIndex);
                }, 10);
            }
        });
        
        // S'assurer également de capturer les transitions via l'observation du conteneur de diapositives
        const slidesContainer = document.querySelector('.carousel-slides');
        if (slidesContainer) {
            slidesContainer.addEventListener('transitionstart', function() {
                // Synchroniser les indicateurs si une transition est détectée
                if (window.currentSlide !== undefined) {
                    console.log('Transition détectée dans les diapositives, synchronisation des indicateurs');
                    animateIndicators(window.currentSlide);
                }
            });
        }
        
        console.log('Contrôles du carrousel initialisés avec succès');
    }, 300); // Délai réduit pour une initialisation plus rapide
});
