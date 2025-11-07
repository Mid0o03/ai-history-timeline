# 🌍 Histoire de la Tech - Interactive AI Timeline

Une frise chronologique interactive en 3D explorant l'histoire de l'intelligence artificielle, de 1950 à 2024.

## ✨ Fonctionnalités

### 🚀 Introduction Spatiale
- Animation de voyage spatial immersive
- Effet "warp speed" avec défilement d'étoiles
- Transition fluide de l'espace vers la Terre

### 🌐 Globe 3D Interactif
- Planète Terre en haute résolution avec textures réalistes
- 4 événements historiques majeurs de l'IA
- Marqueurs géographiques précis
- Lignes de connexion entre les événements
- Nuages animés et comètes aléatoires

### 📚 Événements Historiques
1. **1950** - Alan Turing et le Test de Turing (Manchester, UK)
2. **1966** - Joseph Weizenbaum crée ELIZA (Cambridge, USA)
3. **1997** - Deep Blue bat Garry Kasparov (New York, USA)
4. **2024** - L'Albanie expérimente une IA gouvernementale (Tirana, Albanie)

### 🎮 Modes Interactifs

#### Navigation Manuelle
- Flèches ← → pour naviguer entre les événements
- Transitions fluides avec animation de la planète
- Horloge holographique affichant les années

#### 🎤 Narration Vocale
- Robot narrateur animé
- Synthèse vocale française
- Affichage progressif du texte mot par mot

#### 🎯 Quiz Chrono-Défi
- 4 questions à choix multiples
- Timer de 15 secondes par question
- Score basé sur la vitesse de réponse
- Explications détaillées après chaque réponse

#### 🔮 Prédictions Futur
- 5 scénarios d'IA pour 2030-2050
- Sélection interactive
- Analyse par le robot narrateur

## 🛠️ Technologies

- **React** - Framework UI
- **Three.js** - Rendu 3D
- **@react-three/fiber** - React renderer pour Three.js
- **@react-three/drei** - Helpers pour R3F
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **Web Speech API** - Synthèse vocale

## 🚀 Installation

```bash
# Cloner le repository
git clone https://github.com/Mid0o03/ai-history-timeline.git
cd ai-history-timeline

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

## 🎮 Utilisation

### Écran d'accueil
- Cliquez sur "🚀 Commencer le voyage" ou appuyez sur `ESPACE`

### Navigation
- `←` `→` : Naviguer entre les événements
- `ESPACE` : Passer l'intro (si en cours)
- Bouton microphone : Activer/désactiver la narration vocale

### Quiz
- Disponible après avoir visité tous les événements
- Cliquez sur le bouton "🎮 Quiz" qui apparaît

## 📁 Structure du Projet

```
phrise-chrono/
├── public/
│   └── textures/
│       └── earth/          # Textures de la Terre
├── src/
│   ├── App.jsx            # Composant principal
│   ├── index.css          # Styles globaux
│   └── main.jsx           # Point d'entrée
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

## 🎨 Composants Principaux

- `Globe` - Planète Terre 3D avec rotations
- `IntroTitle` - Titre d'introduction spatial
- `WarpStars` - Effet d'étoiles en mode warp
- `CameraController` - Animation de la caméra
- `Comets` - Système de comètes aléatoires
- `QuizGame` - Jeu de quiz interactif
- `FuturePrediction` - Prédictions futures
- `RobotHead` - Avatar robot animé
- `InfoPanel` - Panneau d'information des événements
- `HoloClock` - Horloge holographique des années

## 🌟 Crédits

Textures de la Terre : NASA / Blue Marble

## 📄 Licence

MIT

---

Créé avec ❤️ pour explorer l'histoire de l'intelligence artificielle
