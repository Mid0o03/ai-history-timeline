import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";

/**
 * Timeline Tech — 3D Globe Demo
 * Stack: React + @react-three/fiber + drei
 * Features: rotating Earth, starfield moving with the planet, smooth transitions between 4 dates
 * Instructions: `npm i three @react-three/fiber @react-three/drei`
 */

// ---- 1) Your 4 dates + text (edit freely) ----------------------------------
const EVENTS = [
  {
    year: 1950,
    title: "Alan Turing et le Test de Turing",
    text: "Dans \"Computing Machinery and Intelligence\", Turing propose son test d’imitation pour évaluer l’intelligence d’une machine et relance la question : les machines peuvent-elles penser ?",
    location: "Manchester, Royaume-Uni",
    accent: "#4ade80",
    lon: -0.1, // Londres, Royaume-Uni
    lat: 51.5,
  },
  {
    year: 1966,
    title: "Joseph Weizenbaum crée ELIZA",
    text: "ELIZA simule un psychothérapeute à partir de mots-clés. Son illusion de compréhension révèle l'effet ELIZA et lance les débats éthiques sur la projection humaine dans les IA.",
    location: "Cambridge, États-Unis",
    accent: "#60a5fa",
    lon: -71.094,
    lat: 42.360,
  },
  {
    year: 1997,
    title: "Deep Blue bat Garry Kasparov",
    text: "Le superordinateur d’IBM s'impose face au champion du monde d’échecs, prouvant qu’une machine peut surpasser l’humain par la puissance de calcul et relançant le débat sur la nature de l’intelligence.",
    location: "New York, États-Unis",
    accent: "#fcd34d",
    lon: -73.985,
    lat: 40.758,
  },
  {
    year: 2024,
    title: "L’Albanie expérimente une IA gouvernementale",
    text: "Une IA assistante entre dans le processus décisionnel public albanais, posant des questions cruciales de transparence, de responsabilité et de légitimité démocratique face à la gouvernance algorithmique.",
    location: "Tirana, Albanie",
    accent: "#f472b6",
    lon: 19.818,
    lat: 41.328,
  },
];

const AUTOPLAY_DURATION = 7200;

// ---- Quiz Questions ---------------------------------------------------------
const QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "En quelle année Alan Turing a-t-il proposé le Test de Turing ?",
    options: ["1945", "1950", "1955", "1960"],
    correct: 1,
    explanation: "C'était en 1950 dans son article 'Computing Machinery and Intelligence'."
  },
  {
    id: 2,
    question: "Qui a créé ELIZA, le premier chatbot ?",
    options: ["Alan Turing", "Joseph Weizenbaum", "Marvin Minsky", "John McCarthy"],
    correct: 1,
    explanation: "Joseph Weizenbaum a créé ELIZA en 1966 au MIT."
  },
  {
    id: 3,
    question: "Dans quelle ville Deep Blue a-t-il battu Kasparov ?",
    options: ["San Francisco", "Boston", "New York", "Chicago"],
    correct: 2,
    explanation: "Le match historique s'est déroulé à New York en 1997."
  },
  {
    id: 4,
    question: "Quel pays a récemment expérimenté une IA gouvernementale ?",
    options: ["Estonie", "Albanie", "Singapour", "Danemark"],
    correct: 1,
    explanation: "L'Albanie a intégré une IA dans son processus décisionnel en 2024."
  }
];

// ---- Future Predictions -----------------------------------------------------
const FUTURE_SCENARIOS = [
  {
    id: 1,
    year: 2030,
    scenario: "Les IA deviennent des assistants personnels obligatoires dans l'éducation",
    impact: "positive",
    icon: "🎓"
  },
  {
    id: 2,
    year: 2035,
    scenario: "Une IA remporte le prix Nobel de médecine pour une découverte majeure",
    impact: "positive",
    icon: "🏆"
  },
  {
    id: 3,
    year: 2040,
    scenario: "Les IA contrôlent 80% des décisions financières mondiales",
    impact: "neutral",
    icon: "💰"
  },
  {
    id: 4,
    year: 2045,
    scenario: "Les IA obtiennent des droits juridiques dans certains pays",
    impact: "controversial",
    icon: "⚖️"
  },
  {
    id: 5,
    year: 2050,
    scenario: "Première IA consciente d'elle-même officiellement reconnue",
    impact: "revolutionary",
    icon: "🧠"
  }
];

// ---- 2) Helpers -------------------------------------------------------------
function degToRad(d) { return (d * Math.PI) / 180; }
function lonLatToXYZ(lonDeg, latDeg, radius) {
  // Three.js sphere is Y-up. Convert lon/lat to 3D position on sphere.
  // Standard equirectangular mapping: lon 0° at front (+Z), lat +90° at +Y
  const lon = degToRad(lonDeg);
  const lat = degToRad(latDeg);
  const x = radius * Math.cos(lat) * Math.sin(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.cos(lon);
  return new THREE.Vector3(x, y, z);
}

// Smoothly damp a value toward a target
function damp(current, target, lambda, dt) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

// Split descriptive paragraphs into digestible sentences for display
function splitSentences(text) {
  if (!text) return [];
  const matches = text.match(/[^.!?]+[.!?]?/g);
  const cleaned = matches ? matches.map((sentence) => sentence.trim()).filter(Boolean) : [];
  const fallback = text.trim();
  return cleaned.length > 0 ? cleaned : fallback ? [fallback] : [];
}

// Create a line curve between two points on the globe
function createCurvePoints(lon1, lat1, lon2, lat2, radius = 1.01) {
  const start = lonLatToXYZ(lon1, lat1, radius);
  const end = lonLatToXYZ(lon2, lat2, radius);
  
  // Create a control point above the surface for arc effect
  const mid = new THREE.Vector3()
    .addVectors(start, end)
    .multiplyScalar(0.5)
    .normalize()
    .multiplyScalar(radius * 1.15); // Raise the arc above surface
  
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  return curve.getPoints(50);
}

// ---- 3) Globe component -----------------------------------------------------
function Globe({ targetLon = 0, targetLat = 0, spinDirection = 0, accent = "#ff5454", allEvents = [], currentIndex = 0, reduceMotion = false, extraRotations = 0 }) {
  const group = useRef(null);
  const earthMesh = useRef(null);
  const markerRef = useRef(null);
  const glowRef = useRef(null);
  const cloudsRef = useRef(null);

  // Animation state
  const rotTarget = useRef(new THREE.Euler(0, 0, 0));
  const accumulatedTarget = useRef({ x: 0, y: 0 });
  const initialised = useRef(false);

  // Textures loaded from /public
  const [colorMap, normalMap, specMap, cloudsMap] = useTexture([
    "/textures/earth/earth_atmos_2048.jpg",
    "/textures/earth/earth_normal_2048.jpg",
    "/textures/earth/earth_specular_2048.jpg",
    "/textures/earth/earth_clouds_2048.png",
  ]);

  // Update rotation target whenever lon/lat changes
  React.useEffect(() => {
    // Aim the given lon/lat toward the camera by rotating Earth so that point faces +Z
    // We set target rotation such that the target lon appears at front center.
    // Simple approach: rotate Y by -lon, and X by lat to tilt.
    const nextX = degToRad(-targetLat);
    const baseNextY = degToRad(-targetLon);

    // Ensure Y rotation keeps spinning forward to simulate time passing
    let adjustedY = baseNextY;
    const { y: previousY } = accumulatedTarget.current;
    const twoPi = Math.PI * 2;

    // Snap to the closest equivalent angle to avoid abrupt jumps backward
    const rotationsDiff = Math.round((previousY - adjustedY) / twoPi);
    adjustedY += rotationsDiff * twoPi;

    if (!initialised.current) {
      // First load: go directly to target orientation without extra spin
      rotTarget.current.set(nextX, adjustedY, 0);
      accumulatedTarget.current = { x: nextX, y: adjustedY };
      initialised.current = true;
      return;
    }

    // Add controlled extra turns to convey time passing, but still stop at target
    if (!reduceMotion && Math.abs(spinDirection) === 1 && extraRotations > 0) {
      adjustedY += (spinDirection > 0 ? 1 : -1) * extraRotations * twoPi;
    }

    rotTarget.current.set(nextX, adjustedY, 0);
    accumulatedTarget.current = { x: nextX, y: adjustedY };
  }, [targetLon, targetLat, spinDirection]);

  useFrame((state, dt) => {
    if (!group.current) return;
    // Smooth rotation toward target
    const smoothing = 1.0;
    group.current.rotation.x = damp(group.current.rotation.x, rotTarget.current.x, smoothing, dt);
    group.current.rotation.y = damp(group.current.rotation.y, rotTarget.current.y, smoothing, dt);

    // If we're very close to the target, snap exactly to avoid perpetual micro-drift
    const eps = 0.0005;
    const dx = Math.abs(group.current.rotation.x - rotTarget.current.x);
    const dy = Math.abs(group.current.rotation.y - rotTarget.current.y);
    if (dx < eps && dy < eps) {
      group.current.rotation.x = rotTarget.current.x;
      group.current.rotation.y = rotTarget.current.y;
    }

    // Animation des nuages
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += dt * 0.01;
    }

    // Pulsations ignorées (pas de marker)
  });

  return (
    <group rotation={[Math.PI / 2, 0, 0]} scale={0.76} position={[-0.31, 0, 0]}>
      <group ref={group}>
        {/* Terre */}
        <mesh ref={earthMesh}>
          <sphereGeometry args={[1, 128, 128]} />
          <meshPhongMaterial map={colorMap} normalMap={normalMap} specularMap={specMap} shininess={8} />
        </mesh>
        {/* Nuages */}
        <mesh ref={cloudsRef}>
          <sphereGeometry args={[1.01, 128, 128]} />
          <meshPhongMaterial map={cloudsMap} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

// ---- 4) Starfield wrapper that follows planet rotation ----------------------
function Starfield({ followRef }) {
  const starsGroup = useRef(null);
  useFrame(() => {
    if (followRef.current && starsGroup.current) {
      // Match rotation exactly — gives the impression the background moves with the planet
      starsGroup.current.rotation.copy(followRef.current.rotation);
    }
  });
  return (
    <group ref={starsGroup}>
      <Stars radius={100} depth={50} count={8000} factor={6} saturation={0} fade={false} speed={0} />
    </group>
  );
}

// ---- 5) Information panel overlay ------------------------------------------
function InfoPanel({ event, sentences, wordsProgress }) {
  const accent = event.accent || "#ffffff";
  const accentShadow = `${accent}55`;
  return (
    <div className="w-full">
      <div
        className="bg-black/70 backdrop-blur rounded-3xl px-5 py-6 text-white max-w-xl md:w-[340px] shadow-2xl border"
        style={{ borderColor: accent, boxShadow: `0 28px 60px -34px ${accentShadow}` }}
      >
        <div>
          <p className="uppercase text-xs tracking-widest text-white/50">Événement</p>
          <h2 className="text-lg md:text-xl font-semibold leading-snug mt-1">{event.title}</h2>
        </div>
        {event.location && (
          <div className="mt-4 flex items-center gap-2 text-sm text-white/70">
            <svg width="16" height="16" viewBox="0 0 16 16" className="opacity-70" aria-hidden="true">
              <path
                d="M8 0.667a5.333 5.333 0 0 0-5.333 5.333c0 3.92 5.333 9.333 5.333 9.333s5.333-5.413 5.333-9.333A5.333 5.333 0 0 0 8 0.667Zm0 7.28a1.947 1.947 0 1 1 0-3.894 1.947 1.947 0 0 1 0 3.894Z"
                fill={accent}
              />
            </svg>
            <span>{event.location}</span>
          </div>
        )}
        <div className="mt-6">
          <p className="uppercase text-xs tracking-widest text-white/50">À retenir</p>
          <ul className="mt-3 space-y-3 text-sm leading-relaxed text-white/80">
            {sentences.map((sentence, index) => {
              const split = sentence.split(/\s+/);
              const n = wordsProgress && wordsProgress[index] || 999;
              const partial = split.slice(0, n).join(' ');
              return (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                  <span>{partial}{n < split.length ? <span className="inline-block animate-blink">|</span> : null}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---- 5b) Robot narrator (SVG) -----------------------------------------------
function RobotHead({ speaking = false, mouth = 0.2, accent = "#ffffff" }) {
  const eyeColor = "#9ca3af"; // neutral gray
  const stroke = "#e5e7eb";
  const mouthHeight = Math.max(0, Math.min(1, mouth));
  const mouthOpen = 2 + mouthHeight * 10; // 2 to 12 px
  return (
    <div className="flex justify-center mb-4 select-none" aria-hidden="true">
      <svg width="100" height="100" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="robotGrad" x1="0" x2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
        </defs>
        <g>
          <rect x="10" y="18" width="100" height="90" rx="16" fill="url(#robotGrad)" stroke={stroke} opacity="0.9" />
          <rect x="24" y="30" width="72" height="16" rx="8" fill="#0b1220" stroke="#1f2937" />
          {/* Eyes */}
          <circle cx="44" cy="38" r="6" fill={eyeColor} />
          <circle cx="76" cy="38" r="6" fill={eyeColor} />
          {/* Antenna */}
          <line x1="60" y1="10" x2="60" y2="18" stroke={stroke} strokeWidth="2" />
          <circle cx="60" cy="10" r="4" fill={accent} />
          {/* Mouth */}
          <rect x="36" y={68 - mouthOpen / 2} width="48" height={mouthOpen} rx="4" fill={accent} opacity={speaking ? 0.9 : 0.4} />
          {/* Cheeks */}
          <circle cx="30" cy="64" r="4" fill={accent} opacity="0.4" />
          <circle cx="90" cy="64" r="4" fill={accent} opacity="0.4" />
        </g>
      </svg>
    </div>
  );
}

// ---- Quiz Component ---------------------------------------------------------
function QuizGame({ onComplete, accent }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [isAnswered, setIsAnswered] = useState(false);

  const question = QUIZ_QUESTIONS[currentQuestion];
  const isLastQuestion = currentQuestion === QUIZ_QUESTIONS.length - 1;

  useEffect(() => {
    if (isAnswered) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentQuestion, isAnswered]);

  const handleTimeout = () => {
    setIsAnswered(true);
    setShowExplanation(true);
  };

  const handleAnswer = (index) => {
    if (isAnswered) return;
    setSelectedAnswer(index);
    setIsAnswered(true);
    if (index === question.correct) {
      setScore(prev => prev + timeLeft * 10);
    }
    setShowExplanation(true);
  };

  const handleNext = () => {
    if (isLastQuestion) {
      onComplete(score + (selectedAnswer === question.correct ? timeLeft * 10 : 0));
    } else {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setTimeLeft(15);
      setIsAnswered(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-2xl mx-4">
        {/* Progress bar */}
        <div className="mb-6 flex items-center justify-between text-sm text-white/60">
          <span>Question {currentQuestion + 1}/{QUIZ_QUESTIONS.length}</span>
          <span className="font-bold" style={{ color: accent }}>Score: {score}</span>
        </div>

        {/* Question card */}
        <div 
          className="bg-black/70 backdrop-blur rounded-3xl p-8 border-2 shadow-2xl"
          style={{ borderColor: accent, boxShadow: `0 28px 60px -20px ${accent}55` }}
        >
          {/* Timer */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/60">Temps restant</span>
              <span className="text-2xl font-bold" style={{ color: timeLeft < 6 ? '#ef4444' : accent }}>
                {timeLeft}s
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-1000 ease-linear rounded-full"
                style={{ 
                  width: `${(timeLeft / 15) * 100}%`,
                  backgroundColor: timeLeft < 6 ? '#ef4444' : accent
                }}
              />
            </div>
          </div>

          {/* Question */}
          <h2 className="text-2xl font-bold text-white mb-6">{question.question}</h2>

          {/* Options */}
          <div className="space-y-3 mb-6">
            {question.options.map((option, index) => {
              const isCorrect = index === question.correct;
              const isSelected = index === selectedAnswer;
              const showResult = showExplanation;

              let buttonClass = "w-full p-4 rounded-xl border-2 text-left transition-all duration-300 ";
              let buttonStyle = {};

              if (!showResult) {
                buttonClass += "border-white/20 hover:border-white/40 hover:bg-white/5 cursor-pointer";
              } else {
                if (isCorrect) {
                  buttonClass += "border-green-500 bg-green-500/20";
                } else if (isSelected && !isCorrect) {
                  buttonClass += "border-red-500 bg-red-500/20";
                } else {
                  buttonClass += "border-white/10 bg-white/5";
                }
              }

              return (
                <button
                  key={index}
                  onClick={() => handleAnswer(index)}
                  disabled={isAnswered}
                  className={buttonClass}
                  style={buttonStyle}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{option}</span>
                    {showResult && isCorrect && <span className="text-2xl">✓</span>}
                    {showResult && isSelected && !isCorrect && <span className="text-2xl">✗</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {showExplanation && (
            <div 
              className="p-4 rounded-xl border-2 mb-6 animate-fadeIn"
              style={{ borderColor: `${accent}40`, backgroundColor: `${accent}10` }}
            >
              <p className="text-white/90">{question.explanation}</p>
            </div>
          )}

          {/* Next button */}
          {showExplanation && (
            <button
              onClick={handleNext}
              className="w-full py-4 rounded-xl font-bold text-lg transition-all hover:scale-105"
              style={{ 
                backgroundColor: accent,
                color: '#000',
                boxShadow: `0 10px 30px -10px ${accent}88`
              }}
            >
              {isLastQuestion ? 'Voir mon score' : 'Question suivante'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Future Prediction Component --------------------------------------------
function FuturePrediction({ quizScore, onRestart, accent }) {
  const [selectedScenarios, setSelectedScenarios] = useState([]);
  const [showRobotOpinion, setShowRobotOpinion] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const toggleScenario = (id) => {
    setSelectedScenarios(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    setShowRobotOpinion(true);
  };

  const handleShowVideo = () => {
    setShowVideo(true);
  };

  const getRobotOpinion = () => {
    const count = selectedScenarios.length;
    if (count === 0) return "Aucune prédiction ? L'avenir est entre vos mains ! 🤖";
    if (count <= 2) return "Une vision prudente de l'avenir. La sagesse guide vos choix. 🧠";
    if (count <= 3) return "Un bon équilibre entre optimisme et réalisme ! 👍";
    if (count <= 4) return "Vous croyez en un futur riche en IA ! L'innovation vous inspire. 🚀";
    return "Toutes les prédictions ! Un vrai visionnaire de l'IA ! ⭐";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md overflow-y-auto py-8">
      <div className="w-full max-w-3xl mx-4">
        {!showRobotOpinion ? (
          <>
            {/* Header */}
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🔮</div>
              <h1 className="text-4xl font-bold mb-2" style={{ color: accent }}>
                Prédictions Futur
              </h1>
              <p className="text-white/70">
                Sélectionnez les scénarios qui vous semblent les plus probables pour le futur de l'IA
              </p>
              {quizScore > 0 && (
                <div className="mt-4 inline-block px-6 py-2 rounded-full bg-white/10 border border-white/20">
                  <span className="text-white/60">Score du quiz: </span>
                  <span className="font-bold" style={{ color: accent }}>{quizScore} pts</span>
                </div>
              )}
            </div>

            {/* Scenarios */}
            <div className="space-y-4 mb-8">
              {FUTURE_SCENARIOS.map(scenario => {
                const isSelected = selectedScenarios.includes(scenario.id);
                return (
                  <button
                    key={scenario.id}
                    onClick={() => toggleScenario(scenario.id)}
                    className={`w-full p-6 rounded-2xl border-2 text-left transition-all duration-300 ${
                      isSelected 
                        ? 'border-opacity-100 scale-[1.02]' 
                        : 'border-white/20 hover:border-white/40'
                    }`}
                    style={{
                      borderColor: isSelected ? accent : undefined,
                      backgroundColor: isSelected ? `${accent}15` : 'rgba(0,0,0,0.5)'
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">{scenario.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold" style={{ color: accent }}>{scenario.year}</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/60">
                            {scenario.impact}
                          </span>
                        </div>
                        <p className="text-white text-lg">{scenario.scenario}</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'scale-110' : ''
                      }`} style={{ borderColor: accent }}>
                        {isSelected && (
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accent }} />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={selectedScenarios.length === 0}
              className="w-full py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ 
                backgroundColor: accent,
                color: '#000',
                boxShadow: `0 10px 30px -10px ${accent}88`
              }}
            >
              Voir l'avis du robot
            </button>
          </>
        ) : (
          /* Robot Opinion */
          <div className="text-center">
            <div className="mb-8">
              <RobotHead speaking={false} mouth={0.5} accent={accent} />
            </div>
            
            <div 
              className="bg-black/70 backdrop-blur rounded-3xl p-8 border-2 mb-8"
              style={{ borderColor: accent, boxShadow: `0 28px 60px -20px ${accent}55` }}
            >
              <h2 className="text-3xl font-bold mb-4" style={{ color: accent }}>
                Analyse du Robot 🤖
              </h2>
              <p className="text-xl text-white/90 mb-6">{getRobotOpinion()}</p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-sm text-white/60 mb-1">Score Quiz</div>
                  <div className="text-2xl font-bold" style={{ color: accent }}>{quizScore}</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-sm text-white/60 mb-1">Prédictions</div>
                  <div className="text-2xl font-bold" style={{ color: accent }}>
                    {selectedScenarios.length}/{FUTURE_SCENARIOS.length}
                  </div>
                </div>
              </div>

              <p className="text-white/70 text-sm">
                Merci d'avoir exploré l'histoire de la technologie ! L'avenir de l'IA dépend de nos choix d'aujourd'hui. 🌟
              </p>
            </div>

            <div className="mt-8">
              <button
                onClick={handleShowVideo}
                className="w-full px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 mb-4"
                style={{ 
                  backgroundColor: accent,
                  color: '#000',
                  boxShadow: `0 10px 30px -10px ${accent}88`
                }}
              >
                🎬 Découvrir la vidéo finale
              </button>

              <button
                onClick={onRestart}
                className="w-full px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 border-2"
                style={{ 
                  borderColor: accent,
                  color: accent,
                }}
              >
                Recommencer l'exploration
              </button>
            </div>
          </div>
        )}

        {/* Video finale */}
        {showVideo && (
          <div className="text-center">
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2" style={{ color: accent }}>
                Et maintenant ? 🎬
              </h2>
              <p className="text-white/70">Découvrez cette vidéo pour aller plus loin</p>
            </div>

            <div className="mb-8 rounded-2xl overflow-hidden border-2 shadow-2xl" style={{ borderColor: accent }}>
              <video 
                controls 
                autoPlay
                className="w-full max-w-4xl mx-auto"
                style={{ maxHeight: '70vh' }}
              >
                <source src="/elevenlab_2025.mp4" type="video/mp4" />
                Votre navigateur ne supporte pas la lecture de vidéos.
              </video>
            </div>

            <button
              onClick={onRestart}
              className="px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105"
              style={{ 
                backgroundColor: accent,
                color: '#000',
                boxShadow: `0 10px 30px -10px ${accent}88`
              }}
            >
              Recommencer l'exploration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineControlBar({ onPrev, onNext, accent, voiceEnabled, onToggleVoice, onStartQuiz, showQuizButton }) {
  return (
    <div
      className="flex items-center gap-3 bg-black/70 border border-white/10 rounded-full px-5 py-3 backdrop-blur shadow-lg"
      style={{ boxShadow: `0 20px 40px -28px ${accent}55` }}
    >
      <button
        onClick={onPrev}
        className="group relative flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 transition hover:border-white/40 hover:bg-white/10"
        aria-label="Événement précédent"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" className="text-white/80 group-hover:text-white" fill="none">
          <path
            d="M10.75 4.25 6.5 9l4.25 4.75"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        onClick={onToggleVoice}
        className={`group relative flex h-10 w-10 items-center justify-center rounded-full border transition hover:border-white/40 hover:bg-white/10 ${
          voiceEnabled ? "border-white/40 bg-white/10" : "border-white/15 bg-white/5"
        }`}
        aria-label={voiceEnabled ? "Désactiver la narration" : "Activer la narration"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" className="text-white group-hover:text-white" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <path d="M12 19v3" />
        </svg>
      </button>
      <button
        onClick={onNext}
        className="group relative flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 transition hover:border-white/40 hover:bg-white/10"
        aria-label="Événement suivant"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" className="text-white/80 group-hover:text-white" fill="none">
          <path
            d="M7.25 4.25 11.5 9l-4.25 4.75"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {showQuizButton && (
        <button
          onClick={onStartQuiz}
          className="ml-2 px-4 py-2 rounded-full font-bold text-sm transition-all hover:scale-105 animate-pulse"
          style={{ 
            backgroundColor: accent,
            color: '#000',
            boxShadow: `0 5px 20px -5px ${accent}88`
          }}
        >
          🎮 Quiz
        </button>
      )}
      <div className="hidden md:flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/60">
        <span>Mode manuel</span>
      </div>
    </div>
  );
}

// ---- 5c) HoloClock sci-fi years overlay ----
function HoloClock({ from, to, progress, active, year }) {
  // Si active : effet zoom/centre/défilement, sinon mode compact fixe en haut droite
  const isTransition = !!active && from && to && from!==to;
  // Année affichée :
  let displayYear = year;
  if (isTransition) {
    displayYear = Math.round(from + (to - from) * progress);
  }
  return (
    <div>
      {/* Mode transition: zoom centre, sinon coin haut droit */}
      <div
        className={
          'fixed select-none pointer-events-none font-extrabold tracking-wide z-40 ' +
          (isTransition
            ? 'left-1/2 top-1/3 -translate-x-1/2 scale-[2] drop-shadow-2xl transition-all duration-500 ease-[cubic-bezier(.3,2,.6,1)]'
            : 'right-8 top-8 text-lg text-cyan-200/90 scale-100 translate-x-0 transition-all duration-800')
        }
        style={{
          filter: isTransition
            ? 'drop-shadow(0 0 24px #67e8f9) drop-shadow(0 0 32px #3b82f6aa)' 
            : 'drop-shadow(0 0 10px #8be9fbcf)',
          background: isTransition ? 'rgba(43,197,235,0.13)' : 'transparent',
          borderRadius: '18px',
          padding: isTransition ? '0.13em 0.45em' : '0.06em 0.6em',
          letterSpacing:'0.09em',
          transition: 'all .6s cubic-bezier(.3,2,.6,1)',
        }}
      >
        <span className="holographic text-5xl md:text-7xl" aria-live="polite">{displayYear}</span>
      </div>
      {isTransition && (
        <div className="fixed left-0 top-0 w-full h-full z-30 backdrop-fade" style={{pointerEvents:'none'}}></div>
      )}
    </div>
  );
}

// ---- 5c) Comet component ----------------------------------------------------
function Comet({ startPos, direction, speed, size }) {
  const cometRef = useRef(null);
  const trailPoints = useRef([]);
  
  useFrame((state, dt) => {
    if (!cometRef.current) return;
    
    // Store current position for trail
    const currentPos = cometRef.current.position.clone();
    trailPoints.current.unshift(currentPos);
    
    // Keep only last few positions for short trail
    if (trailPoints.current.length > 8) {
      trailPoints.current.pop();
    }
    
    // Move comet in direction
    cometRef.current.position.x += direction.x * speed * dt;
    cometRef.current.position.y += direction.y * speed * dt;
    cometRef.current.position.z += direction.z * speed * dt;
    
    // Fade out over distance
    const distance = cometRef.current.position.length();
    if (distance > 20) {
      cometRef.current.visible = false;
    }
  });
  
  return (
    <group ref={cometRef} position={startPos}>
      {/* Comet head - same size as stars */}
      <mesh>
        <sphereGeometry args={[size, 4, 4]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      
      {/* Small light trail behind */}
      {trailPoints.current.map((pos, i) => {
        const opacity = (1 - i / trailPoints.current.length) * 0.4;
        const trailSize = size * (1 - i / trailPoints.current.length) * 0.6;
        return (
          <mesh key={i} position={[pos.x - startPos[0], pos.y - startPos[1], pos.z - startPos[2]]}>
            <sphereGeometry args={[trailSize, 3, 3]} />
            <meshBasicMaterial color="#aaccff" transparent opacity={opacity} />
          </mesh>
        );
      })}
    </group>
  );
}

// ---- 5d) Comets system ------------------------------------------------------
function Comets() {
  const [comets, setComets] = useState([]);
  
  useEffect(() => {
    const spawnComet = () => {
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 10;
      const radius = 15;
      
      const newComet = {
        id: Date.now() + Math.random(),
        startPos: [
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius
        ],
        direction: new THREE.Vector3(
          -Math.cos(angle) + (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.5,
          -Math.sin(angle) + (Math.random() - 0.5) * 0.3
        ).normalize(),
        speed: 2 + Math.random() * 3,
        size: 0.015 + Math.random() * 0.01
      };
      
      setComets(prev => [...prev, newComet]);
      
      // Remove old comets
      setTimeout(() => {
        setComets(prev => prev.filter(c => c.id !== newComet.id));
      }, 10000);
    };
    
    // Spawn first comet
    spawnComet();
    
    // Spawn comets at random intervals
    const interval = setInterval(() => {
      if (Math.random() > 0.2) { // 80% chance every interval
        spawnComet();
      }
    }, 3000 + Math.random() * 3000); // Every 3-6 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <>
      {comets.map(comet => (
        <Comet
          key={comet.id}
          startPos={comet.startPos}
          direction={comet.direction}
          speed={comet.speed}
          size={comet.size}
        />
      ))}
    </>
  );
}

// ---- 5e) Intro Title Component ----------------------------------------------
function IntroTitle({ progress }) {
  const groupRef = useRef(null);
  
  useFrame(() => {
    if (groupRef.current) {
      // Move away from camera
      groupRef.current.position.z = -5 - progress * 8;
    }
  });

  const opacity = Math.max(0, 1 - progress * 1.5);

  return (
    <group ref={groupRef} position={[0, 0, -5]}>
      <Html
        center
        style={{
          opacity: opacity,
          transition: 'opacity 0.3s ease-out',
          pointerEvents: 'none',
        }}
      >
        <div className="text-center select-none" style={{ width: '80vw', maxWidth: '900px' }}>
          <h1 
            className="holographic text-6xl md:text-8xl font-extrabold tracking-wider mb-6"
            style={{
              textShadow: '0 0 40px #4cfaff, 0 0 80px #3b82f6, 0 0 120px #60a5fa',
              letterSpacing: '0.15em'
            }}
          >
            HISTOIRE DE LA TECH
          </h1>
          <p 
            className="text-xl md:text-2xl text-cyan-200/80 font-light tracking-widest"
            style={{
              textShadow: '0 0 20px #4cfaffaa',
            }}
          >
            Un voyage à travers le temps
          </p>
        </div>
      </Html>
    </group>
  );
}

// ---- 5f) Warp Speed Stars ---------------------------------------------------
function WarpStars({ active }) {
  const starsRef = useRef(null);
  const [starPositions] = useState(() => {
    const positions = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      const i3 = i * 3;
      const radius = 10 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi) - 30;
    }
    return positions;
  });

  useFrame((state, dt) => {
    if (!starsRef.current || !active) return;
    const positions = starsRef.current.geometry.attributes.position.array;
    
    for (let i = 0; i < positions.length; i += 3) {
      // Move stars towards camera for warp effect
      positions[i + 2] += dt * 25;
      
      // Reset if too close
      if (positions[i + 2] > 5) {
        positions[i + 2] = -50;
      }
    }
    
    starsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={starPositions.length / 3}
          array={starPositions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.08} color="#ffffff" transparent opacity={0.8} sizeAttenuation />
    </points>
  );
}

// ---- 5g) Camera Animation Controller ----------------------------------------
function CameraController({ introProgress, onIntroComplete }) {
  useFrame((state) => {
    if (introProgress < 1) {
      // Start far away, move closer
      const startZ = 15;
      const endZ = 2.6;
      const easeProgress = 1 - Math.pow(1 - introProgress, 3); // Ease out cubic
      
      state.camera.position.z = startZ - (startZ - endZ) * easeProgress;
      state.camera.position.y = 0;
      state.camera.position.x = 0;
      state.camera.lookAt(0, 0, 0);
      
      if (introProgress >= 0.99 && onIntroComplete) {
        onIntroComplete();
      }
    }
  });

  return null;
}

// ---- 6) Main Scene ----------------------------------------------------------
function Scene({ event, spinDirection, sentences, allEvents, currentIndex, reduceMotion, extraRotations, showIntro, introProgress, onIntroComplete }) {
  // Expose planet group to sync stars
  const planetGroup = useRef(null);
  const accent = event.accent || "#ff5454";

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 3, 5]} intensity={1.1} />
      {/* Subtle fog for depth */}
      <fog attach="fog" args={["#000000", 6, 14]} />

      {/* Camera animation during intro */}
      {showIntro && (
        <CameraController introProgress={introProgress} onIntroComplete={onIntroComplete} />
      )}

      {/* Intro title */}
      {showIntro && introProgress < 0.8 && (
        <IntroTitle progress={introProgress} />
      )}

      {/* Warp speed effect during travel */}
      <WarpStars active={showIntro && introProgress > 0.1 && introProgress < 0.9} />

      {/* Comets flying through space */}
      {!showIntro && <Comets />}

      {/* Starfield that rotates with the planet */}
      {!showIntro && <Starfield followRef={planetGroup} />}

      {/* Planet + marker - fade in during intro */}
      <group 
        ref={planetGroup} 
        scale={showIntro ? introProgress : 1}
        position={[showIntro ? 0 : -0.31, 0, 0]}
      >
        <Globe
          targetLon={event.lon}
          targetLat={event.lat}
          spinDirection={spinDirection}
          accent={accent}
          allEvents={allEvents}
          currentIndex={currentIndex}
          reduceMotion={reduceMotion}
          extraRotations={extraRotations || 0}
        />
      </group>
    </>
  );
}

// ---- 7) UI ------------------------------------------------------------------
export default function App() {
  const [selected, setSelected] = useState(0);
  const [spinDirection, setSpinDirection] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [extraRotations, setExtraRotations] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [mouth, setMouth] = useState(0.2);
  const speechQueueRef = useRef([]);
  const mouthTimerRef = useRef(null);
  const [clockActive, setClockActive] = useState(false);
  const [clockFrom, setClockFrom] = useState(null);
  const [clockTo, setClockTo] = useState(null);
  const [clockProg, setClockProg] = useState(0);
  const [infoPanelWordsProgress, setInfoPanelWordsProgress] = useState([]);
  const prevSelectedRef = useRef(0);
  
  // Quiz states
  const [gameMode, setGameMode] = useState('timeline'); // 'timeline', 'quiz', 'prediction'
  const [quizScore, setQuizScore] = useState(0);
  const [hasVisitedAll, setHasVisitedAll] = useState(false);
  const visitedEvents = useRef(new Set([0]));
  
  // Intro states
  const [showIntro, setShowIntro] = useState(true);
  const [introProgress, setIntroProgress] = useState(0);
  const [introStarted, setIntroStarted] = useState(false);

  const event = EVENTS[selected];
  const sentences = useMemo(() => splitSentences(event.text), [event.text]);
  const accent = event.accent || "#ffffff";

  // Handler functions defined before useEffects
  const handleStartJourney = useCallback(() => {
    console.log('Starting journey...');
    setIntroStarted(true);
  }, []);

  const handleSkipIntro = useCallback(() => {
    console.log('Skipping intro...');
    setShowIntro(false);
    setIntroProgress(1);
  }, []);

  const selectIndex = useCallback(
    (index, { direction } = {}) => {
      const total = EVENTS.length;
      const boundedIndex = ((index % total) + total) % total;
      const computedDirection =
        typeof direction === "number"
          ? direction
          : boundedIndex > selected
          ? 1
          : boundedIndex < selected
          ? -1
          : 0;
      
      // Définir l'année de départ et d'arrivée pour l'horloge
      const fromYear = EVENTS[selected].year;
      const toYear = EVENTS[boundedIndex].year;
      setClockFrom(fromYear);
      setClockTo(toYear);
      
      setSpinDirection(computedDirection);
      prevSelectedRef.current = selected;
      setSelected(boundedIndex);
      
      // Track visited events
      visitedEvents.current.add(boundedIndex);
      if (visitedEvents.current.size === EVENTS.length) {
        setHasVisitedAll(true);
      }
      
      // Compute extra rotations proportional to year gap to simulate time
      const currentYear = EVENTS[selected].year;
      const nextYear = EVENTS[boundedIndex].year;
      const yearGap = Math.abs(nextYear - currentYear);
      const allYears = EVENTS.map(e => e.year);
      const maxGap = allYears.reduce((m, y, i) => (i === 0 ? 0 : Math.max(m, Math.abs(y - allYears[i - 1]))), 0) || 1;
      // Normalize and map to [0.25, 1.75] turns (tweakable)
      const normalized = Math.min(1, yearGap / maxGap);
      const turns = reduceMotion ? 0 : 0.25 + normalized * 1.5;
      setExtraRotations(turns);
    },
    [selected, reduceMotion]
  );

  const goToNext = useCallback(() => {
    const nextIndex = (selected + 1) % EVENTS.length;
    selectIndex(nextIndex, { direction: 1 });
  }, [selected, selectIndex]);

  const goToPrev = useCallback(() => {
    const prevIndex = (selected - 1 + EVENTS.length) % EVENTS.length;
    selectIndex(prevIndex, { direction: -1 });
  }, [selected, selectIndex]);

  // Respect user motion preferences
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(!!mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);

  // Intro animation logic
  useEffect(() => {
    if (!introStarted) return;
    
    const startTime = performance.now();
    const duration = 4000; // 4 seconds for the journey
    
    let raf;
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      setIntroProgress(progress);
      
      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        setShowIntro(false);
      }
    };
    
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [introStarted]);

  useEffect(() => {
    const handleKeyDown = (keyboardEvent) => {
      // Start journey with Space on welcome screen
      if (showIntro && !introStarted && keyboardEvent.key === " ") {
        keyboardEvent.preventDefault();
        handleStartJourney();
        return;
      }
      
      // Skip intro with Space
      if (showIntro && introStarted && keyboardEvent.key === " ") {
        keyboardEvent.preventDefault();
        handleSkipIntro();
        return;
      }
      
      if (keyboardEvent.key === "ArrowRight") {
        keyboardEvent.preventDefault();
        goToNext();
      } else if (keyboardEvent.key === "ArrowLeft") {
        keyboardEvent.preventDefault();
        goToPrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrev, showIntro, introStarted]);

  // ---- 7b) Text-to-Speech orchestration -------------------------------------
  const stopSpeaking = useCallback(() => {
    try { window.speechSynthesis?.cancel(); } catch (_) {}
    setSpeaking(false);
    if (mouthTimerRef.current) {
      clearInterval(mouthTimerRef.current);
      mouthTimerRef.current = null;
    }
    setMouth(0.2);
  }, []);

  const speakSentences = useCallback((items, accentColor) => {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    stopSpeaking();
    // Words setup for each phrase
    setInfoPanelWordsProgress(items.map(() => 1));
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    const preferred = voices.find(v => /fr|Francais|French/i.test(v.lang)) || voices[0];
    speechQueueRef.current = [];
    items.forEach((text, idx) => {
      const u = new SpeechSynthesisUtterance(text);
      if (preferred) u.voice = preferred;
      u.rate = 1.0; // speed
      u.pitch = 0.9; // slightly robotic
      u.volume = 1.0;
      u.onstart = () => {
        setSpeaking(true);
        // Fake mouth movement: vary openness quickly while speaking
        if (!mouthTimerRef.current) {
          mouthTimerRef.current = setInterval(() => {
            setMouth(prev => {
              const next = Math.random() * 0.9 + 0.1;
              return next;
            });
          }, 90);
        }
      };
      // reveal next word on speech event
      u.onboundary = (e) => {
        if (e.name === 'word') {
          setInfoPanelWordsProgress(progArr => {
            const copy = progArr.slice();
            copy[idx] = (copy[idx] || 1) + 1;
            return copy;
          });
        }
      };
      u.onend = () => {
        if (idx === items.length - 1) {
          stopSpeaking();
        }
      };
      speechQueueRef.current.push(u);
    });
    // Chain play
    speechQueueRef.current.forEach(utt => synth.speak(utt));
  }, [stopSpeaking, voiceEnabled]);

  // Trigger narration ONLY at the end of a transition
  useEffect(() => {
    // Arrêter la narration quand une transition commence
    if (clockActive) {
      stopSpeaking();
      setInfoPanelWordsProgress(sentences.map(() => 0));
      return;
    }
    
    // Démarrer la narration uniquement après la fin de la transition
    if (!clockActive && voiceEnabled) {
      speakSentences(sentences, accent);
    }
    // eslint-disable-next-line
  }, [clockActive, sentences, voiceEnabled, stopSpeaking, speakSentences, accent]);

  // Met à jour l'horloge lors d'une transition
  useEffect(() => {
    // transition?: nouvelle date
    let raf = null;
    if (spinDirection !== 0 && selected !== null) {
      setClockActive(true);
      setClockProg(0);
      const startTime = performance.now();
      const tick = (now) => {
        const elapsed = now - startTime;
        const prog = Math.min(1, elapsed / AUTOPLAY_DURATION);
        setClockProg(prog);
        if (prog < 1) raf = requestAnimationFrame(tick);
        else setTimeout(() => setClockActive(false), 400); // petit délai avant réapparition info
      };
      raf = requestAnimationFrame(tick);
    } else {
      setClockActive(false);
    }
    return () => raf && cancelAnimationFrame(raf);
  }, [selected, spinDirection]);

  // reset progress if not voiceEnabled
  useEffect(() => {
    if (!voiceEnabled) setInfoPanelWordsProgress(sentences.map(() => 999));
  }, [voiceEnabled, sentences]);

  // Quiz handlers
  const handleStartQuiz = () => {
    setGameMode('quiz');
    stopSpeaking();
  };

  const handleQuizComplete = (finalScore) => {
    setQuizScore(finalScore);
    setGameMode('prediction');
  };

  const handleRestart = () => {
    setGameMode('timeline');
    setQuizScore(0);
    setHasVisitedAll(false);
    visitedEvents.current = new Set([0]);
    setSelected(0);
    setSpinDirection(0);
  };

  return (
    <div
      className="relative w-screen h-screen bg-black text-white overflow-hidden"
      style={{fontFamily: 'Inter, Segoe UI, Arial, sans-serif'}}
      onMouseMove={(e) => {
        const { innerWidth, innerHeight } = window;
        const x = (e.clientX / innerWidth - 0.5) * 2;
        const y = (e.clientY / innerHeight - 0.5) * 2;
        setParallax({ x, y });
      }}
    >
      {/* Intro Screen - Before everything */}
      {showIntro && !introStarted && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black" style={{ pointerEvents: 'auto' }}>
          <div className="text-center space-y-8 animate-fadeIn" style={{ zIndex: 101 }}>
            <div className="space-y-4">
              <h1 
                className="holographic text-6xl md:text-8xl font-extrabold tracking-wider"
                style={{
                  textShadow: '0 0 40px #4cfaff, 0 0 80px #3b82f6, 0 0 120px #60a5fa',
                  letterSpacing: '0.15em'
                }}
              >
                HISTOIRE DE LA TECH
              </h1>
              <p 
                className="text-xl md:text-2xl text-cyan-200/80 font-light tracking-widest"
                style={{
                  textShadow: '0 0 20px #4cfaffaa',
                }}
              >
                Un voyage à travers le temps
              </p>
            </div>
            
            <button
              onClick={handleStartJourney}
              className="mt-12 px-12 py-5 rounded-full font-bold text-xl transition-all hover:scale-110 animate-pulse cursor-pointer"
              style={{ 
                backgroundColor: '#4cfaff',
                color: '#000',
                boxShadow: '0 0 40px #4cfaffaa, 0 10px 30px -10px #3b82f6aa',
                pointerEvents: 'auto'
              }}
            >
              🚀 Commencer le voyage
            </button>
            
            <p className="text-sm text-white/40 mt-8">
              Ou appuyez sur <kbd className="px-2 py-1 bg-white/10 rounded">ESPACE</kbd> pour démarrer
            </p>
            
            {/* Team members */}
            <div className="mt-16 pt-8 border-t border-white/10">
              <p className="text-xs text-white/30 mb-3 uppercase tracking-widest">Réalisé par</p>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/50">
                <span className="hover:text-cyan-300 transition-colors">Mael Jerome</span>
                <span className="text-white/20">•</span>
                <span className="hover:text-cyan-300 transition-colors">Rami Nebili</span>
                <span className="text-white/20">•</span>
                <span className="hover:text-cyan-300 transition-colors">Noé Chauvin</span>
                <span className="text-white/20">•</span>
                <span className="hover:text-cyan-300 transition-colors">Louis Nourry</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skip button during intro animation */}
      {showIntro && introStarted && introProgress < 1 && (
        <button
          onClick={handleSkipIntro}
          className="fixed top-8 right-8 z-50 px-6 py-3 rounded-full font-bold text-sm transition-all hover:scale-105 bg-white/10 hover:bg-white/20 border border-white/20"
        >
          Passer l'intro →
        </button>
      )}

      {/* Quiz Mode */}
      {gameMode === 'quiz' && (
        <QuizGame onComplete={handleQuizComplete} accent={accent} />
      )}

      {/* Prediction Mode */}
      {gameMode === 'prediction' && (
        <FuturePrediction quizScore={quizScore} onRestart={handleRestart} accent={accent} />
      )}

      {/* Timeline Mode */}
      <HoloClock
        from={clockFrom}
        to={clockTo}
        progress={clockProg}
        active={clockActive}
        year={event.year}
      />
      {/* Only render Canvas after intro starts or if intro is skipped */}
      {(introStarted || !showIntro) && (
        <Canvas
          className="relative z-0"
          camera={{ position: [0, 0, showIntro ? 15 : 2.6], fov: 45 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          dpr={[1, Math.min(2, window.devicePixelRatio || 1)]}
        >
          <Suspense fallback={null}>
            <Scene
              event={event}
              sentences={sentences}
              spinDirection={spinDirection}
              allEvents={EVENTS}
              currentIndex={selected}
              reduceMotion={reduceMotion}
              extraRotations={extraRotations}
              showIntro={showIntro}
              introProgress={introProgress}
              onIntroComplete={() => setShowIntro(false)}
            />
          </Suspense>
        </Canvas>
      )}
      <div
        style={{
          opacity: (!clockActive && !showIntro) ? 1 : 0,
          visibility: (!clockActive && !showIntro) ? 'visible' : 'hidden',
          transition: 'opacity .45s cubic-bezier(.46,1.2,.3,1.0) .3s, visibility 0s linear .3s'
        }}
        aria-hidden={clockActive || showIntro}
      >
        {/* Header aligné en haut à droite */}
        <header className="absolute top-6 left-8 md:left-14 text-left select-none z-30 max-w-[70vw]" role="banner">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Histoire de la Tech</h1>
          <p className="mt-2 text-xs md:text-sm text-white/65">Naviguez avec les flèches ← →</p>
        </header>
        {/* InfoPanel + Robot à droite au centre, vertical */}
        <div className="absolute right-4 md:right-12 top-1/2 -translate-y-1/2 flex flex-col items-center z-30 max-w-[400px] min-w-[260px]">
          {voiceEnabled && (
            <RobotHead speaking={speaking} mouth={mouth} accent={accent} />
          )}
          <InfoPanel event={event} sentences={sentences} wordsProgress={infoPanelWordsProgress} />
        </div>
        {/* Barre de contrôle verticale bas droite */}
        <nav className="absolute bottom-7 right-4 md:right-14 flex flex-col gap-3 z-30" aria-label="Contrôles frise chrono">
          <TimelineControlBar
            onPrev={() => goToPrev()}
            onNext={() => goToNext()}
            accent={accent}
            voiceEnabled={voiceEnabled}
            onToggleVoice={() => {
              const next = !voiceEnabled;
              setVoiceEnabled(next);
              if (!next) {
                try { window.speechSynthesis?.cancel(); } catch (_) {}
              } else {
                if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.getVoices().length === 0) {
                  window.speechSynthesis.onvoiceschanged = () => {};
                }
              }
            }}
            onStartQuiz={handleStartQuiz}
            showQuizButton={hasVisitedAll}
          />
        </nav>
      </div>
    </div>
  );
}
