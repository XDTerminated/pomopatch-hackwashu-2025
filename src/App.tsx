import { useState, useEffect, memo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./globals.css";
import { apiService, Plant } from "./api";

type SeedType = "Berry" | "Fungi" | "Rose";
type ToolType = "Spade" | "WateringCan" | "Fertilizer" | "Backpack";
type WeatherType = "sunny" | "rainy" | "cloudy";

interface SeedPacket {
    id: string;
    type: SeedType;
    image: string;
    price: number;
}

interface Tool {
    id: string;
    type: ToolType;
    image: string;
    price?: number;
}

interface PlacedSprout {
    id: string;
    x: number;
    y: number;
    seedType: SeedType;
    stage?: number;
    species?: string;
    rarity?: number;
    growth_time_remaining?: number | null;
    fertilizer_remaining?: number | null;
}

interface AppProps {
    initialMoney?: number;
    initialPlantLimit?: number;
    initialWeather?: number;
    initialPlants?: Plant[];
    userEmail: string;
    getAuthToken: () => Promise<string | null>;
    onSignOut: () => Promise<void>;
}

interface CoinParticle {
    id: string;
    x: number;
    y: number;
    startX: number;
    startY: number;
}

interface TrailParticle {
    id: string;
    x: number;
    y: number;
    size: number;
}

interface RainDrop {
    id: string;
    x: number;
    delay: number;
    duration: number;
}

interface Lightning {
    id: string;
    opacity: number;
}

interface ToolParticle {
    id: string;
    x: number;
    y: number;
    size: number;
    color: string;
    velocityX: number;
    velocityY: number;
}

// Memoized Rain component to prevent re-renders on mouse move
const Rain = memo(({ rainDrops }: { rainDrops: RainDrop[] }) => {
    return (
        <>
            {rainDrops.map((drop) => (
                <div
                    key={drop.id}
                    className="pointer-events-none fixed"
                    style={{
                        left: `${drop.x}%`,
                        width: "2px",
                        height: "20px",
                        background: "linear-gradient(to bottom, rgba(174, 194, 224, 0.8), rgba(174, 194, 224, 0))",
                        animation: `rainFall ${drop.duration}s linear infinite`,
                        animationDelay: `${drop.delay}s`,
                        zIndex: 10001,
                    }}
                />
            ))}
        </>
    );
});

function App({ initialMoney = 100, initialPlantLimit = 50, initialWeather = 0, initialPlants = [], userEmail, getAuthToken, onSignOut }: AppProps) {
    const [greetMsg, setGreetMsg] = useState("");
    const [name, setName] = useState("");
    const [draggedSeed, setDraggedSeed] = useState<SeedPacket | null>(null);
    const [draggedTool, setDraggedTool] = useState<Tool | null>(null);
    const [isDraggingOverBackground, setIsDraggingOverBackground] = useState(false);
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
    const [potentialDraggedSeed, setPotentialDraggedSeed] = useState<SeedPacket | null>(null);
    const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [money, setMoney] = useState(() => initialMoney ?? 100);
    const [placedSprouts, setPlacedSprouts] = useState<PlacedSprout[]>(() => {
        // Convert backend plants to PlacedSprouts
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        return initialPlants.map((plant) => ({
            id: `plant-${plant.plant_id}`,
            x: centerX + plant.x,
            y: centerY - plant.y,
            seedType: plant.plant_type as SeedType,
            stage: plant.stage,
            species: plant.plant_species,
            rarity: plant.rarity,
            growth_time_remaining: plant.growth_time_remaining,
            fertilizer_remaining: plant.fertilizer_remaining,
        }));
    });
    const [hoveredSproutId, setHoveredSproutId] = useState<string | null>(null);
    const [attachedSproutId, setAttachedSproutId] = useState<string | null>(null);
    const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
    const [isHoveringDollarSign, setIsHoveringDollarSign] = useState(false);
    const [coinParticles, setCoinParticles] = useState<CoinParticle[]>([]);
    const [trailParticles, setTrailParticles] = useState<TrailParticle[]>([]);
    const [mouseDownTime, setMouseDownTime] = useState(0);
    const [sproutAttachedTime, setSproutAttachedTime] = useState(0);
    const [newlyPlacedSproutId, setNewlyPlacedSproutId] = useState<string | null>(null);
    const [lastCursorPosition, setLastCursorPosition] = useState({ x: 0, y: 0 });
    const [wobbleAudio, setWobbleAudio] = useState<HTMLAudioElement | null>(null);
    const weatherAudioRef = useRef<HTMLAudioElement | null>(null);
    const [rainDrops, setRainDrops] = useState<RainDrop[]>([]);
    const [weather, setWeather] = useState<WeatherType>(() => {
        const weatherTypes: WeatherType[] = ["cloudy", "rainy", "sunny"];
        const weatherIndex = initialWeather ?? 0;
        console.log("🌤️ Initializing weather:", { initialWeather, weatherIndex, result: weatherTypes[weatherIndex] });
        return weatherTypes[weatherIndex];
    });
    const [toolParticles, setToolParticles] = useState<ToolParticle[]>([]);
    const [hoveredPacketId, setHoveredPacketId] = useState<string | null>(null);
    const [customCursorPosition, setCustomCursorPosition] = useState({ x: 0, y: 0 });
    const [isHoveringWeather, setIsHoveringWeather] = useState(false);
    const [hoveredToolId, setHoveredToolId] = useState<string | null>(null);
    const [displayedMoney, setDisplayedMoney] = useState(() => initialMoney ?? 100);
    const [inventoryLimit, setInventoryLimit] = useState(initialPlantLimit);
    const [isHoveringPlantCount, setIsHoveringPlantCount] = useState(false);
    const [lightning, setLightning] = useState<Lightning | null>(null);

    // Pomodoro timer state
    const [pomodoroMode, setPomodoroMode] = useState<"none" | "work" | "break">("none");
    const [pomodoroTime, setPomodoroTime] = useState(25 * 60); // 25 minutes in seconds
    const [breakTime, setBreakTime] = useState(5 * 60); // 5 minutes in seconds
    const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
    const [isBreakRunning, setIsBreakRunning] = useState(false);
    const [pomodoroCompleted, setPomodoroCompleted] = useState(false);
    const [isClaimingReward, setIsClaimingReward] = useState(false);
    const [pomodoroCount, setPomodoroCount] = useState(0); // Track number of completed pomodoros
    const [currentPomodoroNumber, setCurrentPomodoroNumber] = useState(1); // Current pomodoro being worked on
    const [currentBreakNumber, setCurrentBreakNumber] = useState(0); // Current break number

    // State for click-to-select functionality (alternative to dragging)
    const [selectedSeed, setSelectedSeed] = useState<SeedPacket | null>(null);
    const [selectedTool, setSelectedTool] = useState<Tool | null>(null);

    // State for tracking current variety shown in seed packet previews
    const [currentVarietyIndices, setCurrentVarietyIndices] = useState<Record<string, number>>({});

    // Plant varieties configuration - easily add new plants to any family/rarity
    const plantVarieties: Record<string, { rarity: number; chance: number; varieties: string[] }[]> = {
        berry: [
            { rarity: 0, chance: 79, varieties: ["blueberry"] },
            { rarity: 1, chance: 20, varieties: ["strawberry"] },
            { rarity: 2, chance: 1, varieties: ["ancient_fruit"] },
        ],
        fungi: [
            { rarity: 0, chance: 79, varieties: ["brown_mushroom"] },
            { rarity: 1, chance: 20, varieties: ["red_mushroom"] },
            { rarity: 2, chance: 1, varieties: ["mario_mushroom"] },
        ],
        rose: [
            { rarity: 0, chance: 79, varieties: ["red_rose"] },
            { rarity: 1, chance: 20, varieties: ["pink_rose", "white_rose"] }, // Multiple varieties swap
            { rarity: 2, chance: 1, varieties: ["withered_rose"] },
        ],
    };

    // Function to play sounds
    const playSound = (soundPath: string) => {
        const audio = new Audio(soundPath);
        audio.volume = 1.0;
        audio.play().catch((error) => console.error("Audio play failed:", error, "Path:", soundPath));
    };

    // Handle wobble sound when sprout is attached
    useEffect(() => {
        if (attachedSproutId) {
            const audio = new Audio("/Audio/wobble.mp3");
            audio.volume = 1.0;
            audio.loop = true;
            audio.play().catch((error) => console.error("Wobble audio play failed:", error));
            setWobbleAudio(audio);

            return () => {
                audio.pause();
                audio.currentTime = 0;
                setWobbleAudio(null);
            };
        }
    }, [attachedSproutId]);

    // Handle rain audio with fade in/out
    useEffect(() => {
        console.log("Rain effect triggered. Current weather:", weather);
        if (weather !== "rainy") {
            console.log("Weather is not rainy, skipping rain audio");
            return;
        }

        console.log("Starting rain audio...");
        // Stop any existing weather audio to avoid overlap
        if (weatherAudioRef.current) {
            try {
                weatherAudioRef.current.pause();
                weatherAudioRef.current.currentTime = 0;
            } catch (e) {
                console.warn("Failed to stop previous weather audio:", e);
            }
            weatherAudioRef.current = null;
        }

        const audio = new Audio("/Audio/rain.mp3");
        audio.loop = true;
        audio.volume = 0;

        const playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log("Rain audio started successfully");
                    // Remember this audio as the current weather audio
                    weatherAudioRef.current = audio;
                    // Fade in to 0.25 volume (half as loud)
                    let fadeInInterval = setInterval(() => {
                        if (audio.volume < 0.25) {
                            audio.volume = Math.min(audio.volume + 0.025, 0.25);
                        } else {
                            clearInterval(fadeInInterval);
                        }
                    }, 50);
                })
                .catch((error) => {
                    console.error("Rain audio play failed:", error);
                    const enableAudio = () => {
                        audio
                            .play()
                            .then(() => {
                                console.log("Rain audio started after user interaction");
                                // Fade in to 0.25 volume (half as loud)
                                let fadeInInterval = setInterval(() => {
                                    if (audio.volume < 0.25) {
                                        audio.volume = Math.min(audio.volume + 0.025, 0.25);
                                    } else {
                                        clearInterval(fadeInInterval);
                                    }
                                }, 50);
                                document.removeEventListener("click", enableAudio);
                            })
                            .catch((e) => console.error("Still failed:", e));
                    };
                    document.addEventListener("click", enableAudio, { once: true });
                });
        }

        return () => {
            console.log("Stopping rain audio...");
            // Fade out
            const fadeOutInterval = setInterval(() => {
                if (audio.volume > 0.05) {
                    audio.volume = Math.max(audio.volume - 0.05, 0);
                } else {
                    audio.pause();
                    audio.currentTime = 0;
                    // Clear reference when stopped
                    if (weatherAudioRef.current === audio) weatherAudioRef.current = null;
                    clearInterval(fadeOutInterval);
                }
            }, 50);
        };
    }, [weather]);

    // Handle birds audio during sunny weather
    useEffect(() => {
        console.log("Birds effect triggered. Current weather:", weather);
        if (weather !== "sunny") {
            console.log("Weather is not sunny, skipping birds audio");
            return;
        }

        console.log("Starting birds audio...");
        // Stop any existing weather audio to avoid overlap
        if (weatherAudioRef.current) {
            try {
                weatherAudioRef.current.pause();
                weatherAudioRef.current.currentTime = 0;
            } catch (e) {
                console.warn("Failed to stop previous weather audio:", e);
            }
            weatherAudioRef.current = null;
        }

        const audio = new Audio("/Audio/birds.mp3");
        audio.loop = true;
        audio.volume = 0;

        const playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log("Birds audio started successfully");
                    // Remember this audio as the current weather audio
                    weatherAudioRef.current = audio;
                    // Fade in to 1.0 volume
                    let fadeInInterval = setInterval(() => {
                        if (audio.volume < 1.0) {
                            audio.volume = Math.min(audio.volume + 0.05, 1.0);
                        } else {
                            clearInterval(fadeInInterval);
                        }
                    }, 50);
                })
                .catch((error) => {
                    console.error("Birds audio play failed:", error);
                    const enableAudio = () => {
                        audio
                            .play()
                            .then(() => {
                                console.log("Birds audio started after user interaction");
                                // Fade in to 1.0 volume
                                let fadeInInterval = setInterval(() => {
                                    if (audio.volume < 1.0) {
                                        audio.volume = Math.min(audio.volume + 0.05, 1.0);
                                    } else {
                                        clearInterval(fadeInInterval);
                                    }
                                }, 50);
                                document.removeEventListener("click", enableAudio);
                            })
                            .catch((e) => console.error("Still failed:", e));
                    };
                    document.addEventListener("click", enableAudio, { once: true });
                });
        }

        return () => {
            console.log("Stopping birds audio...");
            // Fade out
            const fadeOutInterval = setInterval(() => {
                if (audio.volume > 0.05) {
                    audio.volume = Math.max(audio.volume - 0.05, 0);
                } else {
                    audio.pause();
                    audio.currentTime = 0;
                    if (weatherAudioRef.current === audio) weatherAudioRef.current = null;
                    clearInterval(fadeOutInterval);
                }
            }, 50);
        };
    }, [weather]);

    // Handle wind audio randomly during cloudy weather
    useEffect(() => {
        console.log("Wind effect triggered. Current weather:", weather);
        if (weather !== "cloudy") {
            console.log("Weather is not cloudy, skipping wind audio");
            return;
        }

        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let currentAudio: HTMLAudioElement | null = null;
        let isCleanedUp = false;

        const playWind = () => {
            if (isCleanedUp) return;

            console.log("Playing wind audio...");
            // Stop any existing weather audio to avoid overlap
            if (weatherAudioRef.current) {
                try {
                    weatherAudioRef.current.pause();
                    weatherAudioRef.current.currentTime = 0;
                } catch (e) {
                    console.warn("Failed to stop previous weather audio:", e);
                }
                weatherAudioRef.current = null;
            }

            const audio = new Audio("/Audio/wind.mp3");
            audio.volume = 0;
            currentAudio = audio;

            audio
                .play()
                .then(() => {
                    console.log("Wind audio started successfully");
                    // Fade in to 1.0 volume (max allowed)
                    let fadeInInterval = setInterval(() => {
                        if (audio.volume < 1.0) {
                            audio.volume = Math.min(audio.volume + 0.05, 1.0);
                        } else {
                            clearInterval(fadeInInterval);
                        }
                    }, 50);

                    // Remember this audio as the current weather audio
                    weatherAudioRef.current = audio;

                    audio.addEventListener("ended", () => {
                        currentAudio = null;
                        if (!isCleanedUp) {
                            const nextWind = Math.random() * 10000 + 5000;
                            timeoutId = setTimeout(playWind, nextWind);
                        }
                    });
                })
                .catch((error) => {
                            console.error("Wind audio play failed:", error);
                    const enableAudio = () => {
                        audio
                            .play()
                            .then(() => {
                                console.log("Wind audio started after user interaction");
                                // Fade in to 1.0 volume (max allowed)
                                let fadeInInterval = setInterval(() => {
                                    if (audio.volume < 1.0) {
                                        audio.volume = Math.min(audio.volume + 0.05, 1.0);
                                    } else {
                                        clearInterval(fadeInInterval);
                                    }
                                }, 50);
                                document.removeEventListener("click", enableAudio);
                            })
                            .catch((e) => console.error("Wind still failed:", e));
                    };
                    document.addEventListener("click", enableAudio, { once: true });
                });
        };

        timeoutId = setTimeout(playWind, Math.random() * 5000 + 2000);

        return () => {
            console.log("Stopping wind audio...");
            isCleanedUp = true;
            if (timeoutId) clearTimeout(timeoutId);
            if (currentAudio) {
                // Fade out
                const fadeOutInterval = setInterval(() => {
                    if (currentAudio && currentAudio.volume > 0.05) {
                        currentAudio.volume = Math.max(currentAudio.volume - 0.05, 0);
                    } else {
                        if (currentAudio) {
                            currentAudio.pause();
                            currentAudio.currentTime = 0;
                            if (weatherAudioRef.current === currentAudio) weatherAudioRef.current = null;
                        }
                        clearInterval(fadeOutInterval);
                    }
                }, 50);
            }
        };
    }, [weather]);

    // Generate rain drops when weather changes
    useEffect(() => {
        if (weather === "rainy") {
            const drops: RainDrop[] = [];
            for (let i = 0; i < 50; i++) {
                const duration = 1.5 + Math.random() * 0.5;
                const delay = Math.random() * 2 - 2;
                const xPosition = Math.random() * 100;

                drops.push({
                    id: `rain-${i}`,
                    x: xPosition,
                    delay: delay,
                    duration: duration,
                });
            }
            setRainDrops(drops);
        } else {
            setRainDrops([]);
        }
    }, [weather]);

    // Trigger lightning randomly when it's raining
    useEffect(() => {
        if (weather === "rainy") {
            let timeoutId: ReturnType<typeof setTimeout>;

            const triggerLightning = () => {
                const lightningId = `lightning-${Date.now()}`;
                setLightning({ id: lightningId, opacity: 1 });

                playSound("/Audio/thunder.mp3");

                setTimeout(() => {
                    setLightning(null);
                }, 200);

                const nextStrike = Math.random() * 7000 + 8000;
                timeoutId = setTimeout(triggerLightning, nextStrike);
            };

            timeoutId = setTimeout(triggerLightning, Math.random() * 7000 + 8000);

            return () => {
                clearTimeout(timeoutId);
                setLightning(null);
            };
        } else {
            setLightning(null);
        }
    }, [weather]);

    // Animate money counter when money changes
    useEffect(() => {
        const difference = money - displayedMoney;
        if (difference === 0) return;

        // Speed up money animation for snappier feedback
        const duration = 300; // total ms
        const steps = 12;
        const stepValue = difference / steps;
        const stepDuration = duration / steps;

        let currentStep = 0;
        const interval = setInterval(() => {
            currentStep++;
            if (currentStep >= steps) {
                setDisplayedMoney(money);
                clearInterval(interval);
            } else {
                setDisplayedMoney((prev) => prev + stepValue);
            }
        }, stepDuration);

        return () => clearInterval(interval);
    }, [money, displayedMoney]);

    // Periodic backend sync - fetch all plant data from backend on mount
    useEffect(() => {
        const syncWithBackend = async () => {
            try {
                const token = await getAuthToken();
                if (!token) return;

                const plants = await apiService.getUserPlants(userEmail, token);
                console.log("🔄 Syncing plants from backend:", plants);

                // Update plants with backend data
                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;

                setPlacedSprouts((prevSprouts) => {
                    return plants.map((plant: Plant) => {
                        // Try to find existing sprout to preserve x/y position
                        const existing = prevSprouts.find((s) => s.id === `plant-${plant.plant_id}`);

                        return {
                            id: `plant-${plant.plant_id}`,
                            x: existing ? existing.x : centerX + plant.x,
                            y: existing ? existing.y : centerY - plant.y,
                            seedType: plant.plant_type as SeedType,
                            stage: plant.stage,
                            species: plant.plant_species,
                            rarity: plant.rarity,
                            growth_time_remaining: plant.growth_time_remaining,
                            fertilizer_remaining: plant.fertilizer_remaining,
                        };
                    });
                });
            } catch (error) {
                console.error("Failed to sync with backend:", error);
            }
        };

        // Initial sync only - no periodic updates
        syncWithBackend();
    }, [userEmail, getAuthToken]);

    // Pomodoro timer countdown
    useEffect(() => {
        if (pomodoroMode === "work" && isPomodoroRunning && pomodoroTime > 0) {
            const interval = setInterval(() => {
                setPomodoroTime((prev) => {
                    if (prev <= 1) {
                        setIsPomodoroRunning(false);
                        setPomodoroCompleted(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000 / 60); // 60x faster for testing
            return () => clearInterval(interval);
        }
    }, [pomodoroMode, isPomodoroRunning, pomodoroTime]);

    // Break timer countdown
    useEffect(() => {
        if (pomodoroMode === "break" && isBreakRunning && breakTime > 0) {
            const interval = setInterval(() => {
                setBreakTime((prev) => {
                    if (prev <= 1) {
                        setIsBreakRunning(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000 / 60); // 60x faster for testing
            return () => clearInterval(interval);
        }
    }, [pomodoroMode, isBreakRunning, breakTime]);

    // Swap plant varieties in seed packet previews every second when hovering
    useEffect(() => {
        if (!hoveredPacketId) return;

        const interval = setInterval(() => {
            const varieties = plantVarieties[hoveredPacketId];
            if (!varieties) return;

            setCurrentVarietyIndices((prev) => {
                const newIndices = { ...prev };
                varieties.forEach((rarityGroup, rarityIndex) => {
                    if (rarityGroup.varieties.length > 1) {
                        const key = `${hoveredPacketId}-${rarityIndex}`;
                        const currentIndex = prev[key] || 0;
                        newIndices[key] = (currentIndex + 1) % rarityGroup.varieties.length;
                    }
                });
                return newIndices;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [hoveredPacketId, plantVarieties]);

    const seedPackets: SeedPacket[] = [
        {
            id: "berry",
            type: "Berry",
            image: "/Sprites/UI/berryPacket.png",
            price: 100,
        },
        {
            id: "fungi",
            type: "Fungi",
            image: "/Sprites/UI/fungiPacket.png",
            price: 100,
        },
        {
            id: "rose",
            type: "Rose",
            image: "/Sprites/UI/rosePacket.png",
            price: 100,
        },
    ];

    // Calculate the cost for plant limit upgrade based on current limit
    // Backend formula: base_cost * (1.1 ^ upgrade_level) where upgrade_level = (current_limit - 50) / 25
    // Round to nearest 100 using Math.round(cost / 100) * 100
    const calculatePlantLimitUpgradeCost = (): number => {
        const baseLimit = 50;
        const upgradeLevel = Math.max(0, (inventoryLimit - baseLimit) / 25);
        const baseCost = 1000;
        const multiplier = 1.1;
        const rawCost = baseCost * Math.pow(multiplier, upgradeLevel);
        return Math.round(rawCost / 100) * 100;
    };

    const plantLimitUpgradeCost = calculatePlantLimitUpgradeCost();

    const tools: Tool[] = [
        {
            id: "spade",
            type: "Spade",
            image: "/Sprites/UI/Spade.png",
        },
        {
            id: "wateringcan",
            type: "WateringCan",
            image: "/Sprites/UI/wateringcan.png",
            price: 25,
        },
        {
            id: "fertilizer",
            type: "Fertilizer",
            image: "/Sprites/UI/fertilizer.png",
            price: 25,
        },
        {
            id: "backpack",
            type: "Backpack",
            image: "/Sprites/UI/backpack.png",
            price: plantLimitUpgradeCost,
        },
    ];

    // Helper function to get the correct sprite for a plant
    const getPlantSprite = (sprout: PlacedSprout): string => {
        const stage = sprout.stage ?? 0;
        const species = sprout.species;

        if (stage === 0) {
            return "/Sprites/basicSprout.png";
        }

        if (!species) {
            console.warn("🚨 Plant at stage", stage, "missing species, using basicSprout. Sprout:", sprout);
            return "/Sprites/basicSprout.png";
        }

        let plantType = sprout.seedType.toLowerCase();
        const stageNumber = stage;

        if (plantType === "rose") {
            plantType = "roses";
        }

        let spriteSpecies = species;
        if (plantType === "fungi" && species === "mario_mushroom" && stageNumber === 1) {
            spriteSpecies = "mario_mushcroom";
        }

        const spritePath = `/Sprites/${plantType}/${spriteSpecies}_${stageNumber}.png`;
        console.log("🎨 Getting sprite:", { seedType: sprout.seedType, plantType, species, spriteSpecies, stage, path: spritePath });

        return spritePath;
    };

    async function greet() {
        setGreetMsg(await invoke("greet", { name }));
    }

    const handleSeedMouseDown = (seed: SeedPacket) => (e: React.MouseEvent) => {
        console.log("🌱 Mouse down on seed (potential drag):", seed.type);
        e.stopPropagation(); // Prevent event bubbling
        // Don't immediately mark as dragging; record potential drag and mouse down position/time
        setPotentialDraggedSeed(seed);
        setMouseDownPos({ x: e.clientX, y: e.clientY });
        setDragPosition({ x: e.clientX, y: e.clientY });
        setMouseDownTime(Date.now());
    };

    const handleSeedClick = (seed: SeedPacket) => (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log("🌱 Click on seed:", seed.type);
        
        // Don't select if we're dragging
        const timeSinceMouseDown = Date.now() - mouseDownTime;
        if (timeSinceMouseDown > 150) {
            return; // This was a drag, not a click
        }
        
        // Toggle selection: if already selected, deselect; otherwise select
        if (selectedSeed?.id === seed.id) {
            setSelectedSeed(null);
            setSelectedTool(null);
        } else {
            setSelectedSeed(seed);
            setSelectedTool(null);
            playSound("/Audio/interact.mp3");
        }
    };

    const handleToolMouseDown = (tool: Tool) => (e: React.MouseEvent) => {
        console.log("🔧 Mouse down on tool:", tool.type);
        e.stopPropagation(); // Prevent event bubbling
        setDraggedTool(tool);
        setDragPosition({ x: e.clientX, y: e.clientY });
        setMouseDownTime(Date.now());

        if (tool.type === "Spade") {
            playSound("/Audio/spadeclink.mp3");
        } else if (tool.type === "WateringCan") {
            playSound("/Audio/wateringcan.mp3");
        } else if (tool.type === "Fertilizer") {
            playSound("/Audio/fertilizerDrag.mp3");
        }
    };

    const handleToolClick = (tool: Tool) => (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log("🔧 Click on tool:", tool.type);
        
        // Don't select if we're dragging
        const timeSinceMouseDown = Date.now() - mouseDownTime;
        if (timeSinceMouseDown > 150) {
            return; // This was a drag, not a click
        }
        
        // Toggle selection: if already selected, deselect; otherwise select
        if (selectedTool?.id === tool.id) {
            setSelectedTool(null);
            setSelectedSeed(null);
        } else {
            setSelectedTool(tool);
            setSelectedSeed(null);
            if (tool.type === "Spade") {
                playSound("/Audio/spadeclink.mp3");
            } else if (tool.type === "WateringCan") {
                playSound("/Audio/wateringcan.mp3");
            } else if (tool.type === "Fertilizer") {
                playSound("/Audio/fertilizerDrag.mp3");
            }
        }
    };

    const findSproutAtPosition = (x: number, y: number): string | null => {
        const sprout = placedSprouts.find((s) => {
            const dx = Math.abs(s.x - x);
            const dy = Math.abs(s.y - y);
            return dx < 48 && dy < 48;
        });
        return sprout ? sprout.id : null;
    };

    const checkCollision = (x: number, y: number, excludeId?: string): boolean => {
        return placedSprouts.some((s) => {
            if (excludeId && s.id === excludeId) return false;
            const dx = Math.abs(s.x - x);
            const dy = Math.abs(s.y - y);
            return dx < 30 && dy < 30;
        });
    };

    const isInUIArea = (x: number, y: number): boolean => {
        // Top strip - full width
        if (y < 200) return true;
        // Bottom strip - full width
        if (y > window.innerHeight - 200) return true;
        return false;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const newPosition = { x: e.clientX, y: e.clientY };
        setCursorPosition(newPosition);
        setCustomCursorPosition(newPosition);

        if (attachedSproutId) {
            const distance = Math.sqrt(Math.pow(newPosition.x - lastCursorPosition.x, 2) + Math.pow(newPosition.y - lastCursorPosition.y, 2));

            if (distance > 10) {
                const particleCount = 2;
                const newTrails: TrailParticle[] = [];

                for (let i = 0; i < particleCount; i++) {
                    const offsetX = (Math.random() - 0.5) * 20;
                    const offsetY = (Math.random() - 0.5) * 20;
                    const trailId = `trail-${Date.now()}-${i}`;
                    const size = Math.floor(Math.random() * 3) + 3;

                    newTrails.push({
                        id: trailId,
                        x: newPosition.x + offsetX,
                        y: newPosition.y + offsetY,
                        size: size,
                    });

                    setTimeout(() => {
                        setTrailParticles((prev) => prev.filter((t) => t.id !== trailId));
                    }, 500);
                }

                setTrailParticles((prev) => [...prev, ...newTrails]);
                setLastCursorPosition(newPosition);
            }
            return;
        }

        // If the user pressed down on a seed and moved enough, convert potential drag -> actual drag
        if (potentialDraggedSeed) {
            const dx = Math.abs(newPosition.x - mouseDownPos.x);
            const dy = Math.abs(newPosition.y - mouseDownPos.y);
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 6) {
                setDraggedSeed(potentialDraggedSeed);
                setPotentialDraggedSeed(null);
                setIsDraggingOverBackground(true);
            }
        }

        if (draggedSeed) {
            setDragPosition({ x: e.clientX, y: e.clientY });
            setIsDraggingOverBackground(true);
        } else if (draggedTool) {
            setDragPosition({ x: e.clientX, y: e.clientY });
            const sproutId = findSproutAtPosition(e.clientX, e.clientY);
            setHoveredSproutId(sproutId);
        } else {
            // Check for hover even when not dragging anything
            const sproutId = findSproutAtPosition(e.clientX, e.clientY);
            setHoveredSproutId(sproutId);
        }
    };

    const handleGlobalMouseUp = () => {
        if ((draggedSeed || draggedTool) && !attachedSproutId) {
            console.log("🖱️ Mouse up - placing item");

            if (draggedSeed && money >= draggedSeed.price) {
                const hasCollision = checkCollision(cursorPosition.x, cursorPosition.y);
                const inUIArea = isInUIArea(cursorPosition.x, cursorPosition.y);
                const inventoryFull = placedSprouts.length >= inventoryLimit;

                if (!hasCollision && !inUIArea && !inventoryFull) {
                    const centerX = window.innerWidth / 2;
                    const centerY = window.innerHeight / 2;
                    const relativeX = cursorPosition.x - centerX;
                    const relativeY = centerY - cursorPosition.y;
                    const currentMoney = money;

                    const tempSproutId = `temp-plant-${Date.now()}`;
                    const newSprout = {
                        id: tempSproutId,
                        x: cursorPosition.x,
                        y: cursorPosition.y,
                        seedType: draggedSeed.type,
                        stage: 0,
                        growth_time_remaining: null, // New plants can be watered immediately
                    };

                    setPlacedSprouts([...placedSprouts, newSprout]);
                    const optimisticMoney = currentMoney - draggedSeed.price;
                    setMoney(optimisticMoney);
                    playSound("/Audio/placingPlant.mp3");
                    // If a seed was previously selected (click-to-place), clear it to avoid duplicate placement
                    setSelectedSeed(null);

                    const particleCount = 5;
                    const newTrails: TrailParticle[] = [];
                    for (let i = 0; i < particleCount; i++) {
                        const angle = (Math.PI * 2 * i) / particleCount;
                        const distance = 20 + Math.random() * 20;
                        const offsetX = Math.cos(angle) * distance;
                        const offsetY = Math.sin(angle) * distance;
                        const trailId = `plant-${Date.now()}-${i}`;
                        const size = Math.floor(Math.random() * 3) + 3;

                        newTrails.push({
                            id: trailId,
                            x: cursorPosition.x + offsetX,
                            y: cursorPosition.y + offsetY,
                            size: size,
                        });

                        setTimeout(() => {
                            setTrailParticles((prev) => prev.filter((t) => t.id !== trailId));
                        }, 500);
                    }
                    setTrailParticles((prev) => [...prev, ...newTrails]);

                    setNewlyPlacedSproutId(tempSproutId);
                    setTimeout(() => setNewlyPlacedSproutId(null), 400);

                    // Get fresh token before API call
                    getAuthToken()
                        .then((token) => {
                            if (!token) throw new Error("Failed to get auth token");
                            return apiService.createPlant(
                                userEmail,
                                {
                                    plant_type: draggedSeed.type.toLowerCase(),
                                    x: relativeX,
                                    y: relativeY,
                                },
                                token
                            );
                        })
                        .then((response) => {
                            const realSproutId = `plant-${response.plant_id}`;
                            console.log("✅ Plant created successfully:", response);
                            // Update with complete backend data - capture ALL fields
                            setPlacedSprouts((prev) =>
                                prev.map((s) =>
                                    s.id === tempSproutId
                                        ? {
                                              ...s, // Keep x, y, seedType
                                              id: realSproutId,
                                              stage: response.stage ?? s.stage,
                                              species: response.plant_species ?? s.species,
                                              rarity: response.rarity ?? s.rarity,
                                              growth_time_remaining: response.growth_time_remaining ?? s.growth_time_remaining,
                                              fertilizer_remaining: response.fertilizer_remaining ?? s.fertilizer_remaining,
                                          }
                                        : s
                                )
                            );
                            // Prefer backend value when present; otherwise keep optimistic client-side deduction
                            setMoney(response.new_balance ?? optimisticMoney);
                        })
                        .catch((error) => {
                            console.error("Failed to create plant:", error);
                            setPlacedSprouts((prev) => prev.filter((s) => s.id !== tempSproutId));
                            setMoney(currentMoney);
                            playSound("/Audio/error.mp3");
                        });
                } else {
                    playSound("/Audio/error.mp3");
                }
            } else if (draggedTool) {
                if (hoveredSproutId) {
                    if (draggedTool.type === "Spade") {
                        console.log("🌱 Attaching sprout to cursor:", hoveredSproutId);
                        playSound("/Audio/shovel.mp3");
                        setAttachedSproutId(hoveredSproutId);
                        setSproutAttachedTime(Date.now());
                        setLastCursorPosition(cursorPosition);
                        setHoveredSproutId(null);
                    } else if (draggedTool.type === "Fertilizer") {
                        const plantIdStr = hoveredSproutId.replace("plant-", "").replace("temp-plant-", "");
                        const plantId = parseInt(plantIdStr);
                        const targetSprout = placedSprouts.find((s) => s.id === hoveredSproutId);
                        const currentStage = targetSprout?.stage ?? 0;
                        const growthTimeRemaining = targetSprout?.growth_time_remaining;
                        const fertilizerRemaining = targetSprout?.fertilizer_remaining;

                        if (isNaN(plantId) || hoveredSproutId.startsWith("temp-")) {
                            playSound("/Audio/error.mp3");
                            setHoveredSproutId(null);
                            return;
                        }

                        if (currentStage !== 1) {
                            console.log("🌿 Cannot fertilize - plant must be at stage 1 (current stage:", currentStage, ")");
                            playSound("/Audio/error.mp3");
                            setHoveredSproutId(null);
                            return;
                        }

                        // Plant must NOT be growing (growth_time_remaining must be null)
                        // AND must need fertilizer (fertilizer_remaining must be null or > 0)
                        if (growthTimeRemaining !== null) {
                            console.log("🌿 Cannot fertilize - plant is still growing (time remaining:", growthTimeRemaining, ")");
                            playSound("/Audio/error.mp3");
                            setHoveredSproutId(null);
                            return;
                        }

                        // If fertilizer_remaining is 0, plant doesn't need fertilizer
                        if (fertilizerRemaining !== null && fertilizerRemaining !== undefined && fertilizerRemaining <= 0) {
                            console.log("🌿 Cannot fertilize - plant doesn't need fertilizer (fertilizer_remaining:", fertilizerRemaining, ")");
                            playSound("/Audio/error.mp3");
                            setHoveredSproutId(null);
                            return;
                        }

                        const fertilizerCost = draggedTool.price || 25;
                        const currentMoney = money ?? 0;

                        console.log("🌿 Fertilizing plant:", { plantId, currentMoney, fertilizerCost, newMoney: currentMoney - fertilizerCost, fertilizerRemaining, growthTimeRemaining });

                        // Client-side update first - deduct money and update plant state
                        setMoney(currentMoney - fertilizerCost);
                        const newFertilizerRemaining = Math.max(0, (fertilizerRemaining ?? 0) - 1);
                        const shouldStartGrowing = newFertilizerRemaining === 0;
                        setPlacedSprouts((prev) =>
                            prev.map((s) =>
                                s.id === hoveredSproutId
                                    ? {
                                          ...s,
                                          fertilizer_remaining: newFertilizerRemaining,
                                          growth_time_remaining: shouldStartGrowing ? (s.rarity === 0 ? 60 : s.rarity === 1 ? 120 : 360) : s.growth_time_remaining,
                                      }
                                    : s
                            )
                        );
                        playSound("/Audio/fertilizerUse.mp3");

                        const sprout = placedSprouts.find((s) => s.id === hoveredSproutId);
                        if (sprout) {
                            const particleCount = 8;
                            const newParticles: ToolParticle[] = [];
                            for (let i = 0; i < particleCount; i++) {
                                const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
                                const speed = 1 + Math.random() * 2;
                                const particleId = `fertilizer-${Date.now()}-${i}`;

                                newParticles.push({
                                    id: particleId,
                                    x: sprout.x,
                                    y: sprout.y,
                                    size: Math.floor(Math.random() * 4) + 4,
                                    color: "#FFD700",
                                    velocityX: Math.cos(angle) * speed,
                                    velocityY: Math.sin(angle) * speed - 2,
                                });

                                setTimeout(() => {
                                    setToolParticles((prev) => prev.filter((p) => p.id !== particleId));
                                }, 800);
                            }
                            setToolParticles((prev) => [...prev, ...newParticles]);
                        }
                        
                        const hoveredId = hoveredSproutId; // Capture the ID before clearing
                        setHoveredSproutId(null);

                        // Get fresh token before API call
                        getAuthToken().then((token) => {
                            if (token) {
                                apiService
                                    .applyFertilizer(userEmail, plantId, token)
                                    .then((response) => {
                                        console.log("🌿 Fertilizer applied successfully:", response);
                                        // Sync with backend response - update any fields that differ
                                        setPlacedSprouts((prev) =>
                                            prev.map((s) =>
                                                s.id === hoveredId
                                                    ? {
                                                          ...s,
                                                          stage: response.stage ?? s.stage,
                                                          growth_time_remaining: response.growth_time_remaining ?? s.growth_time_remaining,
                                                          fertilizer_remaining: response.fertilizer_remaining ?? s.fertilizer_remaining,
                                                          species: response.plant_species ?? s.species,
                                                          rarity: response.rarity ?? s.rarity,
                                                      }
                                                    : s
                                            )
                                        );
                                        // Use backend money if available
                                        if (response.new_money !== undefined) {
                                            setMoney(response.new_money);
                                        }
                                    })
                                    .catch((error) => {
                                        console.error("❌ Failed to apply fertilizer:", error);
                                        // Rollback on error
                                        setMoney(currentMoney);
                                        setPlacedSprouts((prev) =>
                                            prev.map((s) =>
                                                s.id === hoveredId
                                                    ? {
                                                          ...s,
                                                          fertilizer_remaining: fertilizerRemaining,
                                                          growth_time_remaining: growthTimeRemaining,
                                                      }
                                                    : s
                                            )
                                        );
                                        playSound("/Audio/error.mp3");
                                    });
                            }
                        });
                    } else if (draggedTool.type === "WateringCan") {
                        const plantIdStr = hoveredSproutId.replace("plant-", "").replace("temp-plant-", "");
                        const plantId = parseInt(plantIdStr);
                        const targetSprout = placedSprouts.find((s) => s.id === hoveredSproutId);
                        const currentStage = targetSprout?.stage ?? 0;
                        const growthTimeRemaining = targetSprout?.growth_time_remaining;

                        if (isNaN(plantId) || hoveredSproutId.startsWith("temp-")) {
                            playSound("/Audio/error.mp3");
                            setHoveredSproutId(null);
                            return;
                        }

                        if (currentStage >= 1) {
                            console.log("💧 Cannot water - plant already at stage", currentStage);
                            playSound("/Audio/error.mp3");
                            setHoveredSproutId(null);
                            return;
                        }

                        if (growthTimeRemaining !== null) {
                            console.log("💧 Cannot water - plant is still growing (time remaining:", growthTimeRemaining, ")");
                            playSound("/Audio/error.mp3");
                            setHoveredSproutId(null);
                            return;
                        }

                        const waterCost = draggedTool.price || 25;
                        const currentMoney = money ?? 0;

                        console.log("💧 Watering plant:", { plantId, currentMoney, waterCost, newMoney: currentMoney - waterCost });

                        // Client-side update first - deduct money and update plant state
                        setMoney(currentMoney - waterCost);
                        setPlacedSprouts((prev) =>
                            prev.map((s) => (s.id === hoveredSproutId ? { ...s, growth_time_remaining: 30 } : s))
                        );
                        playSound("/Audio/wateringcanuse.mp3");

                        const sprout = placedSprouts.find((s) => s.id === hoveredSproutId);
                        if (sprout) {
                            const particleCount = 15;
                            const newParticles: ToolParticle[] = [];
                            for (let i = 0; i < particleCount; i++) {
                                const angle = Math.random() * Math.PI - Math.PI / 2;
                                const speed = 2 + Math.random() * 3;
                                const particleId = `water-${Date.now()}-${i}`;

                                newParticles.push({
                                    id: particleId,
                                    x: sprout.x,
                                    y: sprout.y - 30,
                                    size: Math.floor(Math.random() * 5) + 5,
                                    color: "#4A9EFF",
                                    velocityX: Math.cos(angle) * speed,
                                    velocityY: Math.sin(angle) * speed + 3,
                                });

                                setTimeout(() => {
                                    setToolParticles((prev) => prev.filter((p) => p.id !== particleId));
                                }, 800);
                            }
                            setToolParticles((prev) => [...prev, ...newParticles]);
                        }
                        
                        const hoveredId = hoveredSproutId; // Capture the ID before clearing
                        setHoveredSproutId(null);

                        // Get fresh token before API call
                        getAuthToken().then((token) => {
                            if (token) {
                                apiService
                                    .applyWater(userEmail, plantId, token)
                                    .then((response) => {
                                        console.log("💧 Water applied successfully:", response);
                                        // Sync with backend response - update any fields that differ
                                        setPlacedSprouts((prev) =>
                                            prev.map((s) =>
                                                s.id === hoveredId
                                                    ? {
                                                          ...s,
                                                          stage: response.stage ?? s.stage,
                                                          growth_time_remaining: response.growth_time_remaining ?? s.growth_time_remaining,
                                                          fertilizer_remaining: response.fertilizer_remaining ?? s.fertilizer_remaining,
                                                          species: response.plant_species ?? s.species,
                                                          rarity: response.rarity ?? s.rarity,
                                                      }
                                                    : s
                                            )
                                        );
                                        // Use backend money if available
                                        if (response.new_money !== undefined) {
                                            setMoney(response.new_money);
                                        }
                                    })
                                    .catch((error) => {
                                        console.error("❌ Failed to apply water:", error);
                                        // Rollback on error
                                        setMoney(currentMoney);
                                        setPlacedSprouts((prev) =>
                                            prev.map((s) =>
                                                s.id === hoveredId
                                                    ? {
                                                          ...s,
                                                          growth_time_remaining: null,
                                                      }
                                                    : s
                                            )
                                        );
                                        playSound("/Audio/error.mp3");
                                    });
                            }
                        });
                    }
                } else {
                    // Only play error sound if we're not dropping the tool after using shovel to move/sell a plant
                    // AND if this was actually a drag (not just a click to select)
                    const timeSinceMouseDown = Date.now() - mouseDownTime;
                    if (!attachedSproutId && timeSinceMouseDown > 150) {
                        playSound("/Audio/error.mp3");
                    }
                }
            }

            setDraggedSeed(null);
            setDraggedTool(null);
            setIsDraggingOverBackground(false);
            setHoveredSproutId(null);
            // clear any potential drag state from quick clicks
            setPotentialDraggedSeed(null);
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        const timeSinceMouseDown = Date.now() - mouseDownTime;
        const timeSinceSproutAttached = Date.now() - sproutAttachedTime;
        console.log("🖱️ Click event", {
            timeSinceMouseDown,
            timeSinceSproutAttached,
            attachedSproutId,
            selectedSeed,
            selectedTool,
        });

        // Handle click-to-place for selected seed
        if (selectedSeed && !attachedSproutId) {
            console.log("🌱 Placing selected seed:", selectedSeed.type);
            if (money >= selectedSeed.price) {
                const hasCollision = checkCollision(e.clientX, e.clientY);
                const inUIArea = isInUIArea(e.clientX, e.clientY);
                const inventoryFull = placedSprouts.length >= inventoryLimit;

                if (!hasCollision && !inUIArea && !inventoryFull) {
                    const centerX = window.innerWidth / 2;
                    const centerY = window.innerHeight / 2;
                    const relativeX = e.clientX - centerX;
                    const relativeY = centerY - e.clientY;
                    const currentMoney = money;

                    const tempSproutId = `temp-plant-${Date.now()}`;
                    const newSprout = {
                        id: tempSproutId,
                        x: e.clientX,
                        y: e.clientY,
                        seedType: selectedSeed.type,
                        stage: 0,
                        growth_time_remaining: null,
                    };

                    setPlacedSprouts([...placedSprouts, newSprout]);
                    const optimisticMoney = currentMoney - selectedSeed.price;
                    setMoney(optimisticMoney);
                    setSelectedSeed(null); // Deselect after placing
                    playSound("/Audio/placingPlant.mp3");

                    const particleCount = 5;
                    const newTrails: TrailParticle[] = [];
                    for (let i = 0; i < particleCount; i++) {
                        const angle = (Math.PI * 2 * i) / particleCount;
                        const distance = 20 + Math.random() * 20;
                        const offsetX = Math.cos(angle) * distance;
                        const offsetY = Math.sin(angle) * distance;
                        const trailId = `plant-${Date.now()}-${i}`;
                        const size = Math.floor(Math.random() * 3) + 3;

                        newTrails.push({
                            id: trailId,
                            x: e.clientX + offsetX,
                            y: e.clientY + offsetY,
                            size: size,
                        });

                        setTimeout(() => {
                            setTrailParticles((prev) => prev.filter((t) => t.id !== trailId));
                        }, 500);
                    }
                    setTrailParticles((prev) => [...prev, ...newTrails]);

                    setNewlyPlacedSproutId(tempSproutId);
                    setTimeout(() => setNewlyPlacedSproutId(null), 400);

                    getAuthToken()
                        .then((token) => {
                            if (!token) throw new Error("Failed to get auth token");
                            return apiService.createPlant(
                                userEmail,
                                {
                                    plant_type: selectedSeed.type.toLowerCase(),
                                    x: relativeX,
                                    y: relativeY,
                                },
                                token
                            );
                        })
                        .then((response) => {
                            const realSproutId = `plant-${response.plant_id}`;
                            console.log("✅ Plant created successfully:", response);
                            setPlacedSprouts((prev) =>
                                prev.map((s) =>
                                    s.id === tempSproutId
                                        ? {
                                              ...s,
                                              id: realSproutId,
                                              stage: response.stage ?? s.stage,
                                              species: response.plant_species ?? s.species,
                                              rarity: response.rarity ?? s.rarity,
                                              growth_time_remaining: response.growth_time_remaining ?? s.growth_time_remaining,
                                              fertilizer_remaining: response.fertilizer_remaining ?? s.fertilizer_remaining,
                                          }
                                        : s
                                )
                            );
                            // Use backend balance if available, otherwise keep optimistic value
                            setMoney(response.new_balance ?? optimisticMoney);
                        })
                        .catch((error) => {
                            console.error("Failed to create plant:", error);
                            setPlacedSprouts((prev) => prev.filter((s) => s.id !== tempSproutId));
                            setMoney(currentMoney);
                            playSound("/Audio/error.mp3");
                        });
                } else {
                    // Invalid placement - deselect and play error
                    setSelectedSeed(null);
                    playSound("/Audio/error.mp3");
                }
            } else {
                // Can't afford - deselect and play error
                setSelectedSeed(null);
                playSound("/Audio/error.mp3");
            }
            return;
        }

        // Handle click-to-use for selected tool
        if (selectedTool && !attachedSproutId) {
            console.log("🔧 Using selected tool:", selectedTool.type);
            const sproutId = findSproutAtPosition(e.clientX, e.clientY);

            if (sproutId) {
                const sprout = placedSprouts.find((s) => s.id === sproutId);
                if (!sprout) return;

                const plantIdStr = sproutId.replace("plant-", "").replace("temp-plant-", "");
                const plantId = parseInt(plantIdStr);

                if (selectedTool.type === "Spade") {
                    // Pick up plant with spade
                    setAttachedSproutId(sproutId);
                    setSproutAttachedTime(Date.now());
                    setSelectedTool(null); // Deselect after using
                    playSound("/Audio/wobble.mp3");
                } else if (selectedTool.type === "WateringCan") {
                    // Water the plant
                    if (!isNaN(plantId) && !sproutId.startsWith("temp-")) {
                        if (money >= 25) {
                            const currentStage = sprout.stage ?? 0;
                            if (currentStage === 0 && sprout.growth_time_remaining === null) {
                                // Update client-side first (capture previous money for rollback)
                                const prevMoney = money;
                                setMoney(prevMoney - 25);
                                setPlacedSprouts((prev) =>
                                    prev.map((s) => (s.id === sproutId ? { ...s, growth_time_remaining: 30 } : s))
                                );
                                setSelectedTool(null); // Deselect after using

                                const particleCount = 8;
                                const newParticles: ToolParticle[] = [];
                                for (let i = 0; i < particleCount; i++) {
                                    const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.3;
                                    const velocity = 2 + Math.random() * 2;
                                    newParticles.push({
                                        id: `water-${Date.now()}-${i}`,
                                        x: sprout.x,
                                        y: sprout.y - 20,
                                        size: 4 + Math.random() * 4,
                                        color: "rgba(100, 149, 237, 0.8)",
                                        velocityX: Math.cos(angle) * velocity,
                                        velocityY: Math.sin(angle) * velocity,
                                    });
                                }
                                setToolParticles((prev) => [...prev, ...newParticles]);
                                // Use the watering can use sound for both drag and click flows
                                playSound("/Audio/wateringcanuse.mp3");

                                getAuthToken()
                                    .then((token) => {
                                        if (!token) throw new Error("Failed to get auth token");
                                        return apiService.applyWater(userEmail, plantId, token);
                                    })
                                    .then((response) => {
                                        console.log("💧 Water response:", response);
                                        setPlacedSprouts((prev) =>
                                            prev.map((s) =>
                                                s.id === sproutId
                                                    ? {
                                                          ...s,
                                                          growth_time_remaining: response.growth_time_remaining ?? s.growth_time_remaining,
                                                      }
                                                    : s
                                            )
                                        );
                                        // If server reports new balance, use it; otherwise keep optimistic value
                                        setMoney(response.new_balance ?? (prevMoney - 25));
                                    })
                                    .catch((error) => {
                                        console.error("❌ Failed to water plant:", error);
                                        // Rollback optimistic update
                                        setMoney(prevMoney);
                                        playSound("/Audio/error.mp3");
                                    });
                            } else {
                                playSound("/Audio/error.mp3");
                            }
                        } else {
                            playSound("/Audio/error.mp3");
                        }
                    }
                } else if (selectedTool.type === "Fertilizer") {
                    // Apply fertilizer
                    if (!isNaN(plantId) && !sproutId.startsWith("temp-")) {
                        if (money >= 25) {
                            const currentStage = sprout.stage ?? 0;
                            const fertilizerNeeded = (sprout.fertilizer_remaining ?? 0) > 0;

                            if (currentStage === 1 && fertilizerNeeded && sprout.growth_time_remaining === null) {
                                // Update client-side first (capture previous money for rollback)
                                const prevMoney = money;
                                setMoney(prevMoney - 25);
                                const newFertilizerRemaining = Math.max(0, (sprout.fertilizer_remaining ?? 0) - 1);
                                const shouldStartGrowing = newFertilizerRemaining === 0;
                                setPlacedSprouts((prev) =>
                                    prev.map((s) =>
                                        s.id === sproutId
                                            ? {
                                                  ...s,
                                                  fertilizer_remaining: newFertilizerRemaining,
                                                  growth_time_remaining: shouldStartGrowing ? (sprout.rarity === 0 ? 60 : sprout.rarity === 1 ? 120 : 360) : s.growth_time_remaining,
                                              }
                                            : s
                                    )
                                );
                                setSelectedTool(null); // Deselect after using

                                const particleCount = 8;
                                const newParticles: ToolParticle[] = [];
                                for (let i = 0; i < particleCount; i++) {
                                    const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.3;
                                    const velocity = 2 + Math.random() * 2;
                                    newParticles.push({
                                        id: `fertilizer-${Date.now()}-${i}`,
                                        x: sprout.x,
                                        y: sprout.y - 20,
                                        size: 4 + Math.random() * 4,
                                        color: "rgba(139, 69, 19, 0.8)",
                                        velocityX: Math.cos(angle) * velocity,
                                        velocityY: Math.sin(angle) * velocity,
                                    });
                                }
                                setToolParticles((prev) => [...prev, ...newParticles]);
                                playSound("/Audio/fertilizerUse.mp3");

                                getAuthToken()
                                    .then((token) => {
                                        if (!token) throw new Error("Failed to get auth token");
                                        return apiService.applyFertilizer(userEmail, plantId, token);
                                    })
                                    .then((response) => {
                                        console.log("🌿 Fertilizer response:", response);
                                        setPlacedSprouts((prev) =>
                                            prev.map((s) =>
                                                s.id === sproutId
                                                    ? {
                                                          ...s,
                                                          fertilizer_remaining: response.fertilizer_remaining ?? s.fertilizer_remaining,
                                                          growth_time_remaining: response.growth_time_remaining ?? s.growth_time_remaining,
                                                      }
                                                    : s
                                            )
                                        );
                                        // Use server balance if provided, otherwise keep optimistic deduction
                                        setMoney(response.new_balance ?? (prevMoney - 25));
                                    })
                                    .catch((error) => {
                                        console.error("❌ Failed to apply fertilizer:", error);
                                        // Rollback optimistic update
                                        setMoney(prevMoney);
                                        playSound("/Audio/error.mp3");
                                    });
                            } else {
                                playSound("/Audio/error.mp3");
                            }
                        } else {
                            playSound("/Audio/error.mp3");
                        }
                    }
                }
            } else {
                // Clicked on empty space with tool selected - deselect
                setSelectedTool(null);
            }
            return;
        }

        if (attachedSproutId && timeSinceSproutAttached < 200) {
            console.log("❌ Ignoring click - sprout was just attached");
            return;
        }

        if (timeSinceMouseDown < 100) {
            console.log("❌ Ignoring click - too soon after mouse down");
            return;
        }

        if (attachedSproutId) {
            console.log("✅ Processing click with attached sprout");
            if (isHoveringDollarSign) {
                const sproutToSell = placedSprouts.find((s) => s.id === attachedSproutId);
                if (sproutToSell) {
                    const plantIdStr = attachedSproutId.replace("plant-", "").replace("temp-plant-", "");
                    const plantId = parseInt(plantIdStr);
                    const plantStage = sproutToSell.stage ?? 0;

                    if (isNaN(plantId) || attachedSproutId.startsWith("temp-")) {
                        playSound("/Audio/error.mp3");
                        return;
                    }

                    console.log("💰 Selling plant:", { plantId, plantStage });

                    // Calculate sell price client-side
                    const stage = sproutToSell.stage ?? 0;
                    const rarity = sproutToSell.rarity ?? 0;
                    const basePrice = stage === 1 ? 10 : stage === 2 ? 20 : 0;
                    const rarityMultiplier = rarity === 0 ? 1 : rarity === 1 ? 2 : 3;
                    const sellPrice = basePrice * rarityMultiplier;

                    if (plantStage > 0) {
                        const newCoins: CoinParticle[] = [];
                        for (let i = 0; i < 5; i++) {
                            newCoins.push({
                                id: `coin-${Date.now()}-${i}`,
                                x: cursorPosition.x,
                                y: cursorPosition.y,
                                startX: cursorPosition.x,
                                startY: cursorPosition.y,
                            });
                        }
                        setCoinParticles([...coinParticles, ...newCoins]);

                        setTimeout(() => {
                            setCoinParticles((prev) => prev.filter((c) => !newCoins.find((nc) => nc.id === c.id)));
                        }, 1000);
                    }

                    // Client-side update first
                    const prevMoney = money;
                    setMoney(prevMoney + sellPrice);
                    setPlacedSprouts(placedSprouts.filter((s) => s.id !== attachedSproutId));
                    setAttachedSproutId(null);
                    setIsHoveringDollarSign(false);
                    playSound("/Audio/sell.mp3");

                    // Then sync with backend
                    getAuthToken()
                        .then((token) => {
                            if (!token) throw new Error("Failed to get auth token");
                            return apiService.sellPlant(userEmail, plantId, token);
                        })
                        .then((response) => {
                            console.log("💰 Sell response:", response);
                            // Use backend balance if available
                            if (response.new_balance !== undefined) {
                                setMoney(response.new_balance);
                            }
                        })
                        .catch((error) => {
                            console.error("❌ Failed to sell plant:", error);
                            // Rollback on error
                            setMoney(prevMoney);
                            playSound("/Audio/error.mp3");
                        });
                }
                return;
            }

            const hasCollision = checkCollision(e.clientX, e.clientY, attachedSproutId);
            const inUIArea = isInUIArea(e.clientX, e.clientY);

            if (!hasCollision && !inUIArea) {
                const plantIdStr = attachedSproutId.replace("plant-", "").replace("temp-plant-", "");
                const plantId = parseInt(plantIdStr);

                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;
                const relativeX = e.clientX - centerX;
                const relativeY = centerY - e.clientY;

                console.log("🚚 Moving plant:", { plantId, isTemp: attachedSproutId.startsWith("temp-"), relativeX, relativeY });
                setPlacedSprouts(placedSprouts.map((sprout) => (sprout.id === attachedSproutId ? { ...sprout, x: e.clientX, y: e.clientY } : sprout)));

                const particleCount = 5;
                const newTrails: TrailParticle[] = [];
                for (let i = 0; i < particleCount; i++) {
                    const angle = (Math.PI * 2 * i) / particleCount;
                    const distance = 20 + Math.random() * 20;
                    const offsetX = Math.cos(angle) * distance;
                    const offsetY = Math.sin(angle) * distance;
                    const trailId = `replant-${Date.now()}-${i}`;
                    const size = Math.floor(Math.random() * 3) + 3;

                    newTrails.push({
                        id: trailId,
                        x: e.clientX + offsetX,
                        y: e.clientY + offsetY,
                        size: size,
                    });

                    setTimeout(() => {
                        setTrailParticles((prev) => prev.filter((t) => t.id !== trailId));
                    }, 500);
                }
                setTrailParticles((prev) => [...prev, ...newTrails]);

                setNewlyPlacedSproutId(attachedSproutId);
                setTimeout(() => setNewlyPlacedSproutId(null), 400);

                setAttachedSproutId(null);
                playSound("/Audio/placingPlant.mp3");

                if (!isNaN(plantId) && !attachedSproutId.startsWith("temp-")) {
                    // Get fresh token before API call
                    getAuthToken()
                        .then((token) => {
                            if (!token) throw new Error("Failed to get auth token");
                            return apiService.movePlant(userEmail, plantId, { x: relativeX, y: relativeY }, token);
                        })
                        .then(() => {
                            console.log("🚚 Plant moved successfully");
                        })
                        .catch((error) => {
                            console.error("❌ Failed to move plant:", error);
                            playSound("/Audio/error.mp3");
                        });
                }
            } else {
                playSound("/Audio/error.mp3");
            }
        } else {
            // Clicked on empty space - deselect any selected items
            if (selectedSeed || selectedTool) {
                setSelectedSeed(null);
                setSelectedTool(null);
            }
        }
    };

    const getWeatherIcon = () => {
        switch (weather) {
            case "sunny":
                return "/Sprites/UI/sunlogo.png";
            case "rainy":
                return "/Sprites/UI/rainlogo.png";
            case "cloudy":
                return "/Sprites/UI/cloudylogo.png";
            default:
                return "/Sprites/UI/sunlogo.png";
        }
    };

    const getWeatherDescription = () => {
        switch (weather) {
            case "sunny":
                return "Plants give 1.5x more coins";
            case "rainy":
                return "Plants grow 1.5x faster";
            case "cloudy":
                return "No effects happen";
            default:
                return "";
        }
    };

    // Calculate income multiplier based on plants
    const calculateIncomeMultiplier = (): number => {
        let multiplier = 1.0;
        placedSprouts.forEach((sprout) => {
            const stage = sprout.stage ?? 0;
            const rarity = sprout.rarity ?? 0;
            
            if (stage === 1) {
                // Rare: +0.5%, Epic: +1%, Legendary: +2.5%
                if (rarity === 0) multiplier += 0.005;
                else if (rarity === 1) multiplier += 0.01;
                else if (rarity === 2) multiplier += 0.025;
            } else if (stage === 2) {
                // Double the multiplier for stage 2
                if (rarity === 0) multiplier += 0.01;
                else if (rarity === 1) multiplier += 0.02;
                else if (rarity === 2) multiplier += 0.05;
            }
        });
        return multiplier;
    };

    // Get individual plant's income multiplier contribution
    const getPlantIncomeBonus = (sprout: PlacedSprout): string => {
        const stage = sprout.stage ?? 0;
        const rarity = sprout.rarity ?? 0;
        
        if (stage === 0) return "";
        
        let bonus = 0;
        if (stage === 1) {
            if (rarity === 0) bonus = 0.5;
            else if (rarity === 1) bonus = 1.0;
            else if (rarity === 2) bonus = 2.5;
        } else if (stage === 2) {
            if (rarity === 0) bonus = 1.0;
            else if (rarity === 1) bonus = 2.0;
            else if (rarity === 2) bonus = 5.0;
        }
        
        return bonus > 0 ? `+${bonus.toFixed(1)}%` : "";
    };

    // Format time display (MM:SS)
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Start pomodoro session
    const handleStartPomodoro = () => {
        setPomodoroMode("work");
        setPomodoroTime(25 * 60);
        setIsPomodoroRunning(true); // Auto-start timer
        setPomodoroCompleted(false);
        setPomodoroCount(0); // Reset counter on new session
        setCurrentPomodoroNumber(1); // Start at Pomodoro #1
        setCurrentBreakNumber(0); // Reset break counter
    };

    // Exit pomodoro session (no rewards)
    const handleExitPomodoro = () => {
        setPomodoroMode("none");
        setPomodoroTime(25 * 60);
        setBreakTime(5 * 60);
        setIsPomodoroRunning(false);
        setIsBreakRunning(false);
        setPomodoroCompleted(false);
        // Don't reset counters here - they'll reset on next Start Pomodoro
    };

    // Claim pomodoro rewards
    const handleClaimPomodoroReward = async () => {
        // Prevent multiple claims
        if (isClaimingReward) return;
        setIsClaimingReward(true);

        const multiplier = calculateIncomeMultiplier();
        const baseCoins = 125;

        // Apply weather effect to income (sunny = 1.5x multiplicative)
        const weatherMultiplier = weather === "sunny" ? 1.5 : 1.0;
        const coinsEarned = Math.floor(baseCoins * multiplier * weatherMultiplier);

        // Apply weather effect to time (rainy = 1.5x multiplicative)
        const timeMultiplier = weather === "rainy" ? 1.5 : 1.0;
        const timeToGrow = Math.floor(25 * timeMultiplier);

        // Play coin animation
        const newCoins: CoinParticle[] = [];
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        for (let i = 0; i < 10; i++) {
            newCoins.push({
                id: `coin-${Date.now()}-${i}`,
                x: centerX,
                y: centerY,
                startX: centerX,
                startY: centerY,
            });
        }
        setCoinParticles([...coinParticles, ...newCoins]);
        setTimeout(() => {
            setCoinParticles((prev) => prev.filter((c) => !newCoins.find((nc) => nc.id === c.id)));
        }, 1000);

        // Add coins to user
        setMoney(money + coinsEarned);
        playSound("/Audio/sell.mp3");

        // Cycle weather CLIENT-SIDE FIRST (cloudy -> rainy -> sunny -> repeat)
        const weatherTypes: WeatherType[] = ["cloudy", "rainy", "sunny"];
        const currentWeatherIndex = weatherTypes.indexOf(weather);
        const nextWeatherIndex = (currentWeatherIndex + 1) % weatherTypes.length;
        const newWeather = weatherTypes[nextWeatherIndex];
        console.log("🌤️ Cycling weather:", { from: weather, to: newWeather });
        setWeather(newWeather);

        // Update plants CLIENT-SIDE FIRST - simulate growth
        setPlacedSprouts((prev) =>
            prev.map((sprout) => {
                if (sprout.id.startsWith("temp-")) return sprout;
                
                const currentGrowth = sprout.growth_time_remaining;
                if (currentGrowth === null || currentGrowth === undefined) return sprout;
                
                const newGrowthTime = Math.max(0, currentGrowth - timeToGrow);
                
                // If growth completes, advance stage
                if (newGrowthTime === 0) {
                    const currentStage = sprout.stage ?? 0;
                    if (currentStage >= 2) return sprout; // Already max stage
                    
                    const newStage = currentStage + 1;
                    
                    // If advancing to stage 1, set fertilizer_remaining based on rarity
                    if (newStage === 1) {
                        const rarity = sprout.rarity ?? 0;
                        const fertilizerNeeded = rarity + 1; // Rare=1, Epic=2, Legendary=3
                        return {
                            ...sprout,
                            stage: newStage,
                            growth_time_remaining: null,
                            fertilizer_remaining: fertilizerNeeded,
                        };
                    } else {
                        // Advancing to stage 2
                        return {
                            ...sprout,
                            stage: newStage,
                            growth_time_remaining: null,
                        };
                    }
                } else {
                    // Still growing
                    return {
                        ...sprout,
                        growth_time_remaining: newGrowthTime,
                    };
                }
            })
        );

        // Now sync with backend
        try {
            const token = await getAuthToken();
            if (!token) throw new Error("Failed to get auth token");

            // Run all backend syncs independently so one failure doesn't block others
            const growPromises = placedSprouts
                .filter((sprout) => !sprout.id.startsWith("temp-"))
                .map(async (sprout) => {
                    const plantId = parseInt(sprout.id.replace("plant-", ""));
                    if (!isNaN(plantId)) {
                        return apiService.growPlant(userEmail, plantId, { time: timeToGrow }, token);
                    }
                    return null;
                });

            // Execute all backend operations independently
            await Promise.allSettled([
                Promise.all(growPromises),
                apiService.changeMoney(userEmail, coinsEarned, token),
                apiService.cycleWeather(userEmail, token),
            ]).then((results) => {
                results.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        const labels = ['grow plants', 'update money', 'cycle weather'];
                        console.error(`Failed to ${labels[index]}:`, result.reason);
                    }
                });
            });

        } catch (error) {
            console.error("Failed to process pomodoro rewards:", error);
        }

        // Don't increment counter yet - wait until break is claimed
        // Determine if the NEXT break should be long (based on current count + 1)
        const nextBreakNumber = pomodoroCount + 1;
        const isLongBreak = nextBreakNumber % 4 === 0;
        const breakDuration = isLongBreak ? 15 * 60 : 5 * 60; // 15 min for long, 5 min for short
        
        // Start break mode
        setPomodoroMode("break");
        setBreakTime(breakDuration);
        setIsBreakRunning(true); // Auto-start break timer
        setPomodoroCompleted(false);
        setIsClaimingReward(false);
        setCurrentBreakNumber(nextBreakNumber); // Break number is what it will be after completion
    };

    // Claim break reward and restart pomodoro
    const handleClaimBreakReward = async () => {
        // Prevent multiple claims
        if (isClaimingReward) return;
        setIsClaimingReward(true);

        // Check if this is a long break (every 4th pomodoro)
        const isLongBreak = currentBreakNumber % 4 === 0;
        const breakMultiplier = isLongBreak ? 3 : 1; // Triple rewards for long breaks
        
        const multiplier = calculateIncomeMultiplier();
        const baseCoins = 25 * breakMultiplier; // Triple coins for long breaks
        
        // Apply weather effect to income (sunny = 1.5x multiplicative)
        const weatherMultiplier = weather === "sunny" ? 1.5 : 1.0;
        const coinsEarned = Math.floor(baseCoins * multiplier * weatherMultiplier);
        
        // Apply weather effect to time (rainy = 1.5x multiplicative)
        const timeMultiplier = weather === "rainy" ? 1.5 : 1.0;
        const baseTime = 5 * breakMultiplier; // Triple time for long breaks
        const timeToGrow = Math.floor(baseTime * timeMultiplier);

        // Play coin animation
        const newCoins: CoinParticle[] = [];
        const breakX = window.innerWidth - 150;
        const breakY = window.innerHeight - 150;
        const coinCount = isLongBreak ? 15 : 5; // More coins for long breaks
        for (let i = 0; i < coinCount; i++) {
            newCoins.push({
                id: `coin-${Date.now()}-${i}`,
                x: breakX,
                y: breakY,
                startX: breakX,
                startY: breakY,
            });
        }
        setCoinParticles([...coinParticles, ...newCoins]);
        setTimeout(() => {
            setCoinParticles((prev) => prev.filter((c) => !newCoins.find((nc) => nc.id === c.id)));
        }, 1000);

        // Add coins to user
        setMoney(money + coinsEarned);
        playSound("/Audio/sell.mp3");

        // Update plants CLIENT-SIDE FIRST - simulate growth
        setPlacedSprouts((prev) =>
            prev.map((sprout) => {
                if (sprout.id.startsWith("temp-")) return sprout;
                
                const currentGrowth = sprout.growth_time_remaining;
                if (currentGrowth === null || currentGrowth === undefined) return sprout;
                
                const newGrowthTime = Math.max(0, currentGrowth - timeToGrow);
                
                // If growth completes, advance stage
                if (newGrowthTime === 0) {
                    const currentStage = sprout.stage ?? 0;
                    if (currentStage >= 2) return sprout; // Already max stage
                    
                    const newStage = currentStage + 1;
                    
                    // If advancing to stage 1, set fertilizer_remaining based on rarity
                    if (newStage === 1) {
                        const rarity = sprout.rarity ?? 0;
                        const fertilizerNeeded = rarity + 1; // Rare=1, Epic=2, Legendary=3
                        return {
                            ...sprout,
                            stage: newStage,
                            growth_time_remaining: null,
                            fertilizer_remaining: fertilizerNeeded,
                        };
                    } else {
                        // Advancing to stage 2
                        return {
                            ...sprout,
                            stage: newStage,
                            growth_time_remaining: null,
                        };
                    }
                } else {
                    // Still growing
                    return {
                        ...sprout,
                        growth_time_remaining: newGrowthTime,
                    };
                }
            })
        );

        // Now sync with backend
        try {
            const token = await getAuthToken();
            if (!token) throw new Error("Failed to get auth token");

            // Grow all plants on backend
            const growPromises = placedSprouts
                .filter((sprout) => !sprout.id.startsWith("temp-"))
                .map(async (sprout) => {
                    const plantId = parseInt(sprout.id.replace("plant-", ""));
                    if (!isNaN(plantId)) {
                        return apiService.growPlant(userEmail, plantId, { time: timeToGrow }, token);
                    }
                    return null;
                });

            await Promise.all(growPromises);

            // Update money on backend
            await apiService.changeMoney(userEmail, coinsEarned, token);

        } catch (error) {
            console.error("Failed to process break rewards:", error);
        }

        // NOW increment the pomodoro counter (after break is claimed)
        setPomodoroCount(currentBreakNumber);

        // Restart pomodoro - auto-start the next one
        setPomodoroMode("work");
        setPomodoroTime(25 * 60);
        setIsPomodoroRunning(true); // Auto-start timer
        setPomodoroCompleted(false);
        setIsClaimingReward(false);
        setCurrentPomodoroNumber(currentBreakNumber + 1); // Set the next pomodoro number
    };

    return (
        <>
            <img
                src={draggedSeed || draggedTool || selectedSeed || selectedTool || attachedSproutId ? "/Sprites/UI/cursorgrab.png" : "/Sprites/UI/cursor.png"}
                alt="cursor"
                className="image-pixelated pointer-events-none fixed object-contain"
                style={{
                    left: customCursorPosition.x,
                    top: customCursorPosition.y,
                    width: "24px",
                    height: "24px",
                    transform: "translate(-50%, -50%)",
                    zIndex: 99999,
                }}
                draggable={false}
            />

            {/* Show selected seed or tool following cursor */}
            {(selectedSeed || selectedTool) && (
                <img
                    // When a seed is selected for click-to-place, show the sprout preview
                    src={selectedSeed ? "/Sprites/basicSprout.png" : selectedTool!.image}
                    alt={selectedSeed ? `${selectedSeed.type} sprout` : `${selectedTool!.type} tool`}
                    className="image-pixelated pointer-events-none fixed object-contain"
                    style={{
                        left: customCursorPosition.x,
                        top: customCursorPosition.y,
                        width: "48px",
                        height: "48px",
                        transform: "translate(-50%, -50%)",
                        zIndex: 99998,
                        opacity: 0.7,
                        filter: "drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5))",
                    }}
                    draggable={false}
                />
            )}

            {weather === "rainy" && <Rain rainDrops={rainDrops} />}

            {lightning && (
                <div
                    className="pointer-events-none fixed inset-0 bg-white"
                    style={{
                        opacity: lightning.opacity,
                        zIndex: 10002,
                        animation: "lightningFlash 0.2s ease-out",
                    }}
                />
            )}

            <main
                className="h-screen w-full flex justify-center relative"
                style={{
                    backgroundImage: "url('/Sprites/UI/background.png')",
                    backgroundRepeat: "repeat",
                    backgroundSize: "128px 128px",
                    imageRendering: "pixelated",
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleGlobalMouseUp}
                onClick={handleClick}
            >
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        backgroundColor: weather === "sunny" ? "rgba(255, 230, 100, 0.35)" : weather === "rainy" ? "rgba(100, 120, 140, 0.4)" : "rgba(255, 255, 255, 0)",
                        mixBlendMode: "multiply",
                        zIndex: 0,
                        transition: "background-color 2s ease-in-out",
                    }}
                />

                {placedSprouts.map((sprout) => {
                    const isAttached = attachedSproutId === sprout.id;
                    const isHovered = hoveredSproutId === sprout.id;
                    const isNewlyPlaced = newlyPlacedSproutId === sprout.id;
                    const hasCollision = isAttached && checkCollision(cursorPosition.x, cursorPosition.y, sprout.id);
                    const inUIArea = isAttached && isInUIArea(cursorPosition.x, cursorPosition.y);

                    // Use ONLY what the backend actually sends us - no assumptions
                    const stage = sprout.stage;
                    const growthTime = sprout.growth_time_remaining;
                    const fertilizerNeeded = sprout.fertilizer_remaining;

                    // Debug logging for plants with missing info
                    if (stage === 1 && growthTime === null && (fertilizerNeeded === null || fertilizerNeeded === undefined)) {
                        console.log("🐛 Plant missing fertilizer info:", {
                            id: sprout.id,
                            stage,
                            growthTime,
                            fertilizerNeeded,
                            species: sprout.species,
                            fullSprout: sprout
                        });
                    }

                    return (
                        <div
                            key={sprout.id}
                            className="pointer-events-none absolute"
                            style={{
                                left: isAttached ? cursorPosition.x - 48 : sprout.x - 48,
                                top: isAttached ? cursorPosition.y - 48 : sprout.y - 48,
                                zIndex: isAttached ? 9999 : 1,
                            }}
                        >
                            <img
                                src={getPlantSprite(sprout)}
                                alt={`${sprout.seedType} sprout`}
                                className="image-pixelated w-24 h-24 object-contain"
                                draggable={false}
                                style={{
                                    opacity: isAttached ? 0.7 : 1,
                                    filter: isAttached && isHoveringDollarSign ? "sepia(100%) saturate(500%) hue-rotate(60deg) brightness(1.2)" : hasCollision || inUIArea ? "sepia(100%) saturate(500%) hue-rotate(-50deg) brightness(0.8)" : isHovered ? "brightness(1.3) saturate(0.9)" : "none",
                                    transition: isAttached ? "none" : "all 0.3s",
                                    animation: isAttached ? "shake 0.15s ease-in-out infinite" : isNewlyPlaced ? "settle 0.4s ease-out" : "none",
                                }}
                            />

                            {/* Show sell price when hovering over dollar sign with attached plant */}
                            {isAttached && isHoveringDollarSign && (() => {
                                const stage = sprout.stage ?? 0;
                                const rarity = sprout.rarity ?? 0;
                                // Calculate sell price: base price by stage, multiplied by rarity
                                const basePrice = stage === 1 ? 10 : stage === 2 ? 20 : 0;
                                const rarityMultiplier = rarity === 0 ? 1 : rarity === 1 ? 2 : 3;
                                const sellPrice = basePrice * rarityMultiplier;

                                if (sellPrice > 0) {
                                    return (
                                        <div
                                            className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full text-2xl font-bold text-green-400 pointer-events-none"
                                            style={{ filter: "drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.8))", zIndex: 10000 }}
                                        >
                                            +${sellPrice}
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                            
                            {/* Always visible icons for water/fertilizer needs */}
                            {!isAttached && stage === 0 && growthTime === null && (
                                <div className="absolute flex items-center gap-1 wiggle" style={{ zIndex: 2, top: '8px', right: '8px' }}>
                                    <img src="/Sprites/UI/wateringcan.png" className="image-pixelated w-6 h-6" alt="needs water" draggable={false} />
                                </div>
                            )}
                            {!isAttached && stage === 1 && growthTime === null && fertilizerNeeded !== null && fertilizerNeeded !== undefined && fertilizerNeeded > 0 && (
                                <div className="absolute flex items-center gap-1 wiggle" style={{ zIndex: 2, top: '8px', right: '8px' }}>
                                    <img src="/Sprites/UI/fertilizer.png" className="image-pixelated w-6 h-6" alt="needs fertilizer" draggable={false} />
                                    <span className="text-white text-xs font-bold">x{fertilizerNeeded}</span>
                                </div>
                            )}
                            
                            {/* Always visible time remaining for growing plants */}
                            {!isAttached && growthTime !== null && growthTime !== undefined && growthTime > 0 && (
                                <div 
                                    className="absolute left-1/2 transform -translate-x-1/2"
                                    style={{ zIndex: 2, top: 'calc(100% - 30px)' }}
                                >
                                    <span className="text-white text-xs font-bold whitespace-nowrap">{growthTime} mins</span>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Render tooltip for hovered plant - outside plant containers to ensure it's always on top */}
                {hoveredSproutId && pomodoroMode !== "work" && (() => {
                    const hoveredSprout = placedSprouts.find(s => s.id === hoveredSproutId);
                    if (!hoveredSprout) return null;

                    const stage = hoveredSprout.stage;
                    const growthTime = hoveredSprout.growth_time_remaining;
                    const fertilizerNeeded = hoveredSprout.fertilizer_remaining;

                    return (
                        <div
                            className="fixed text-xs px-3 py-2 whitespace-nowrap font-bold"
                            style={{
                                left: hoveredSprout.x,
                                bottom: `calc(100vh - ${hoveredSprout.y - 48}px - 30px)`,
                                transform: "translateX(-50%)",
                                zIndex: 2147483647,
                                pointerEvents: "none",
                                backgroundColor: "#E8C9A0",
                                border: "3px solid #8B4513",
                                color: "#9e4539",
                                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                                imageRendering: "pixelated",
                            }}
                        >
                            <div className="flex flex-col gap-1">
                                {/* Species (rarity color) and Family - Hidden for seedlings */}
                                {stage === 0 ? (
                                    <div className="font-bold text-gray-700">
                                        ??? (???)
                                    </div>
                                ) : (
                                    <div className={`font-bold ${hoveredSprout.rarity === 0 ? "text-blue-800" : hoveredSprout.rarity === 1 ? "text-purple-800" : "text-amber-800"}`}>
                                        {(hoveredSprout.species || "Unknown").split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} ({(hoveredSprout.seedType || "").charAt(0).toUpperCase() + (hoveredSprout.seedType || "").slice(1)})
                                    </div>
                                )}

                                {/* Rarity with star - Hidden for seedlings */}
                                {stage === 0 ? (
                                    <div className="text-gray-700">
                                        ★ ???
                                    </div>
                                ) : (
                                    hoveredSprout.rarity !== undefined && (
                                        <div className={hoveredSprout.rarity === 0 ? "text-blue-800" : hoveredSprout.rarity === 1 ? "text-purple-800" : "text-amber-800"}>
                                            ★ {hoveredSprout.rarity === 0 ? "Rare" : hoveredSprout.rarity === 1 ? "Epic" : "Legendary"}
                                        </div>
                                    )
                                )}

                                {/* Income Multiplier */}
                                {getPlantIncomeBonus(hoveredSprout) && (
                                    <div className="text-green-800">
                                        💰 Income: {getPlantIncomeBonus(hoveredSprout)}
                                    </div>
                                )}

                                {/* Stage */}
                                <div className="text-purple-800">
                                    🌿 Stage: {stage === 0 ? "Sprout" : stage === 1 ? "Seedling" : "Mature"}
                                </div>

                                {/* Time to next stage */}
                                {growthTime !== null && growthTime !== undefined && growthTime > 0 && (
                                    <div className="text-blue-800">
                                        🕐 {growthTime} mins to next stage
                                    </div>
                                )}

                                {/* Fertilizer needed */}
                                {fertilizerNeeded !== null && fertilizerNeeded !== undefined && fertilizerNeeded > 0 && (
                                    <div className="text-amber-800">
                                        🌱 Fertilizer needed ({fertilizerNeeded}x)
                                    </div>
                                )}

                                {/* Water needed - only for stage 0 without growth time */}
                                {stage === 0 && growthTime === null && (
                                    <div className="text-blue-800">
                                        💧 Water needed
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {isDraggingOverBackground &&
                    draggedSeed &&
                    (() => {
                        const hasCollision = checkCollision(dragPosition.x, dragPosition.y);
                        const inUIArea = isInUIArea(dragPosition.x, dragPosition.y);
                        const canAfford = money >= draggedSeed.price;
                        const inventoryFull = placedSprouts.length >= inventoryLimit;

                        return (
                            <div
                                className="image-pixelated pointer-events-none absolute w-24 h-24"
                                style={{
                                    left: dragPosition.x - 48,
                                    top: dragPosition.y - 48,
                                    filter: hasCollision || !canAfford || inUIArea || inventoryFull ? "sepia(100%) saturate(500%) hue-rotate(-50deg) brightness(0.8)" : "brightness(1.2) saturate(1.5) contrast(1.1)",
                                    zIndex: 9999,
                                }}
                            >
                                <img src="/Sprites/basicSprout.png" alt="sprout preview" className="w-full h-full object-contain" draggable={false} />
                            </div>
                        );
                    })()}

                {draggedTool &&
                    !attachedSproutId &&
                    (() => {
                        const rotation = hoveredSproutId ? 15 : 0;
                        return (
                            <img
                                src={draggedTool.image}
                                alt="tool preview"
                                className="image-pixelated pointer-events-none absolute h-12 w-auto object-contain"
                                draggable={false}
                                style={{
                                    left: dragPosition.x - 24,
                                    top: dragPosition.y - 24,
                                    zIndex: 9999,
                                    transform: `rotate(${rotation}deg)`,
                                    transition: "transform 0.2s ease-out",
                                }}
                            />
                        );
                    })()}

                {trailParticles.map((trail) => {
                    const halfSize = trail.size / 2;
                    return (
                        <div
                            key={trail.id}
                            className="pointer-events-none absolute"
                            style={{
                                left: trail.x - halfSize,
                                top: trail.y - halfSize,
                                width: `${trail.size}px`,
                                height: `${trail.size}px`,
                                zIndex: 1,
                                opacity: 0.7,
                                animation: "trailFade 0.5s ease-out forwards",
                                backgroundColor: "#654321",
                                imageRendering: "pixelated",
                            }}
                        />
                    );
                })}

                {toolParticles.map((particle) => {
                    const duration = particle.color === "#FFD700" ? 0.8 : 0.6;
                    return (
                        <div
                            key={particle.id}
                            className="pointer-events-none absolute rounded-full"
                            style={
                                {
                                    left: particle.x,
                                    top: particle.y,
                                    width: `${particle.size}px`,
                                    height: `${particle.size}px`,
                                    backgroundColor: particle.color,
                                    animation: `toolParticleFloat ${duration}s ease-out forwards`,
                                    "--particle-x": `${particle.velocityX * 30}px`,
                                    "--particle-y": `${particle.velocityY * 30}px`,
                                } as React.CSSProperties
                            }
                        />
                    );
                })}

                {coinParticles.map((coin) => {
                    const targetX = window.innerWidth - 150;
                    const targetY = 80;

                    return (
                        <img
                            key={coin.id}
                            src="/Sprites/coin.png"
                            alt="coin"
                            className="image-pixelated pointer-events-none absolute w-8 h-8 object-contain animate-coin-fly"
                            draggable={false}
                            style={
                                {
                                    left: coin.startX,
                                    top: coin.startY,
                                    zIndex: 10000,
                                    animation: `coinFly 1s ease-out forwards`,
                                    animationDelay: `${Math.random() * 0.1}s`,
                                    "--target-x": `${targetX - coin.startX}px`,
                                    "--target-y": `${targetY - coin.startY}px`,
                                } as React.CSSProperties
                            }
                        />
                    );
                })}

                <div className="h-full w-full flex flex-col justify-between relative z-10">
                    <div className="flex flex-row justify-between h-fit w-full p-8">
                        <div className="flex flex-row gap-4 items-start">
                            <div className="relative w-fit h-fit">
                                <img src="/Sprites/UI/PacketUI.png" className="image-pixelated w-[300px] h-auto" alt="packet ui" draggable={false} />
                                <ol className="absolute inset-0 flex flex-row justify-between items-center gap-3 px-10">
                                    {seedPackets.map((seed) => {
                                        const canAfford = money >= seed.price;
                                        const isHovered = hoveredPacketId === seed.id;
                                        return (
                                            <li
                                                key={seed.id}
                                                onMouseDown={canAfford ? handleSeedMouseDown(seed) : () => playSound("/Audio/error.mp3")}
                                                onClick={canAfford ? handleSeedClick(seed) : () => playSound("/Audio/error.mp3")}
                                                onMouseEnter={() => {
                                                    playSound("/Audio/interact.mp3");
                                                    setHoveredPacketId(seed.id);
                                                }}
                                                onMouseLeave={() => setHoveredPacketId(null)}
                                                className={`size-16 flex justify-center items-center flex-col gap-0.5 transition-all ${draggedSeed?.id === seed.id || selectedSeed?.id === seed.id ? "opacity-50 cursor-grab active:cursor-grabbing active:scale-95" : canAfford ? "opacity-100 cursor-grab active:cursor-grabbing active:scale-95" : "opacity-30 cursor-not-allowed"} ${!draggedSeed && canAfford ? "wiggle-hover" : ""}`}
                                                style={{
                                                    filter: !canAfford ? "grayscale(100%)" : "none",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <img src={seed.image} className="w-fit h-full image-pixelated object-contain pointer-events-none" alt={`${seed.type} packet`} draggable={false} style={{ filter: "drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.3))" }} />
                                                
                                                {/* Seed packet tooltip */}
                                                {isHovered && !draggedSeed && !selectedSeed && (
                                                    <div
                                                        className="absolute bottom-full mb-2 text-sm px-3 py-1 whitespace-nowrap z-50 font-bold pointer-events-none"
                                                        style={{
                                                            backgroundColor: "#D4A574",
                                                            border: "3px solid #8B4513",
                                                            color: "#9e4539",
                                                            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                                                            imageRendering: "pixelated",
                                                        }}
                                                    >
                                                        {seed.type === "Berry" ? "Berry Seeds" : seed.type === "Fungi" ? "Mushroom Seeds" : "Rose Seeds"}
                                                    </div>
                                                )}

                                                {isHovered && plantVarieties[seed.id] && (
                                                    <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                                                        {plantVarieties[seed.id].map((rarityGroup, rarityIndex) => {
                                                            // Determine position based on number of rarity groups
                                                            const totalGroups = plantVarieties[seed.id].length;
                                                            let leftPosition = "50%";
                                                            let transform = "translateX(-50%)";

                                                            if (totalGroups === 3) {
                                                                if (rarityIndex === 0) {
                                                                    leftPosition = "-50%";
                                                                    transform = "none";
                                                                } else if (rarityIndex === 1) {
                                                                    leftPosition = "50%";
                                                                    transform = "translateX(-50%)";
                                                                } else {
                                                                    leftPosition = "auto";
                                                                    transform = "none";
                                                                }
                                                            }

                                                            // Get current variety to show (swap if multiple)
                                                            const varietyKey = `${seed.id}-${rarityIndex}`;
                                                            const varietyIndex = currentVarietyIndices[varietyKey] || 0;
                                                            const currentVariety = rarityGroup.varieties[varietyIndex];

                                                            // Determine plant type for sprite path
                                                            let plantType = seed.id;
                                                            if (plantType === "rose") plantType = "roses";

                                                            return (
                                                                <div
                                                                    key={rarityIndex}
                                                                    className="absolute flex flex-col items-center gap-1"
                                                                    style={{
                                                                        top: "100%",
                                                                        left: leftPosition !== "auto" ? leftPosition : undefined,
                                                                        right: leftPosition === "auto" ? "-50%" : undefined,
                                                                        transform: transform !== "none" ? transform : undefined,
                                                                        filter: !canAfford ? "grayscale(100%)" : "none",
                                                                    }}
                                                                >
                                                                    <img src={`/Sprites/${plantType}/${currentVariety}_2.png`} className="w-12 h-12 image-pixelated object-cover" alt={currentVariety} draggable={false} style={{ width: "48px", height: "48px" }} />
                                                                    <div className="text-xs text-white font-bold whitespace-nowrap">{rarityGroup.chance}%</div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                <div className={`text-sm pointer-events-none font-bold ${!canAfford ? "text-red-600" : ""}`} style={{ color: !canAfford ? "" : "#9e4539" }}>
                                                    ${seed.price}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </div>

                            <div className="relative w-fit h-fit">
                                <img src="/Sprites/UI/PacketUI.png" className="image-pixelated w-[300px] h-auto" alt="tool packet ui" draggable={false} />
                                <ol className="absolute inset-0 flex flex-row justify-between items-center gap-3 px-10">
                                    {tools
                                        .filter((tool) => tool.type === "WateringCan" || tool.type === "Fertilizer" || tool.type === "Backpack")
                                        .map((tool) => {
                                            return (
                                                <li
                                                    key={tool.id}
                                                    onMouseDown={!attachedSproutId && tool.type !== "Backpack" ? handleToolMouseDown(tool) : undefined}
                                                    onClick={async (e) => {
                                                        if (tool.type === "Backpack" && money >= (tool.price || 0)) {
                                                            try {
                                                                const upgradeCost = tool.price || 0;
                                                                // Update client side first for instant feedback
                                                                setMoney(money - upgradeCost);
                                                                setInventoryLimit(inventoryLimit + 25);
                                                                playSound("/Audio/interact.mp3");

                                                                // Get fresh token before API call
                                                                const token = await getAuthToken();
                                                                if (!token) throw new Error("Failed to get auth token");

                                                                // Then sync with backend
                                                                const result = await apiService.increasePlantLimit(userEmail || "", token);
                                                                console.log("Plant limit upgrade result:", result);
                                                                // Update with backend values to ensure sync
                                                                setMoney(result.new_balance ?? result.money ?? money - upgradeCost);
                                                                setInventoryLimit(result.new_plant_limit ?? result.plant_limit ?? inventoryLimit + 25);
                                                            } catch (error) {
                                                                console.error("Failed to upgrade plant limit:", error);
                                                                // Rollback on error
                                                                setMoney(money);
                                                                setInventoryLimit(inventoryLimit);
                                                                playSound("/Audio/error.mp3");
                                                            }
                                                        } else if (tool.type === "Backpack") {
                                                            playSound("/Audio/error.mp3");
                                                        } else if (!attachedSproutId) {
                                                            // Handle click-to-select for water/fertilizer
                                                            handleToolClick(tool)(e);
                                                        }
                                                    }}
                                                    onMouseEnter={() => {
                                                        if (!attachedSproutId) {
                                                            playSound("/Audio/interact.mp3");
                                                            setHoveredToolId(tool.id);
                                                        }
                                                    }}
                                                    onMouseLeave={() => {
                                                        setHoveredToolId(null);
                                                    }}
                                                    className={`size-16 flex justify-center items-center flex-col gap-0.5 transition-all relative ${tool.type === "Backpack" ? (money >= (tool.price || 0) ? "opacity-100 cursor-pointer active:scale-95" : "opacity-30 cursor-not-allowed") : draggedTool?.id === tool.id || selectedTool?.id === tool.id ? "opacity-50 cursor-grab active:cursor-grabbing active:scale-95" : attachedSproutId ? "opacity-30 cursor-not-allowed" : "opacity-100 cursor-grab active:cursor-grabbing active:scale-95"} ${!draggedTool && !attachedSproutId && (tool.type === "Backpack" ? money >= (tool.price || 0) : true) ? "wiggle-hover" : ""}`}
                                                    style={{
                                                        pointerEvents: tool.type === "Backpack" ? "auto" : attachedSproutId ? "none" : "auto",
                                                        filter: tool.type === "Backpack" && money < (tool.price || 0) ? "grayscale(100%)" : "none",
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    <div className="h-full flex items-center justify-center">
                                                        <img src={tool.image} className={`image-pixelated object-contain pointer-events-none ${tool.type === "Backpack" ? "w-10 h-10" : "w-fit h-full"}`} alt={`${tool.type} tool`} draggable={false} style={{ filter: "drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.3))" }} />
                                                    </div>
                                                    <div className="text-sm pointer-events-none font-bold" style={{ color: "#9e4539" }}>
                                                        ${tool.price}
                                                    </div>

                                                    {hoveredToolId === tool.id && (tool.type !== "Backpack" ? !attachedSproutId : true) && (
                                                        <div
                                                            className="absolute top-full mt-2 text-sm px-3 py-2 whitespace-nowrap z-50 font-bold pointer-events-none"
                                                            style={{
                                                                backgroundColor: "#D4A574",
                                                                border: "3px solid #8B4513",
                                                                color: "#9e4539",
                                                                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                                                                imageRendering: "pixelated",
                                                                transform: "none",
                                                                animation: "none",
                                                            }}
                                                        >
                                                            {tool.type === "WateringCan" && "Enables sprouts to grow"}
                                                            {tool.type === "Fertilizer" && "Enables growth to maturity"}
                                                            {tool.type === "Backpack" && `Extra Plant Slots (+25)`}
                                                        </div>
                                                    )}
                                                </li>
                                            );
                                        })}
                                </ol>
                            </div>

                            <div className="flex flex-col items-center relative self-center mt-2" onMouseEnter={() => setIsHoveringWeather(true)} onMouseLeave={() => setIsHoveringWeather(false)}>
                                <img src={getWeatherIcon()} alt={`${weather} weather`} className="image-pixelated w-12 h-12 object-contain" draggable={false} style={{ filter: "drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.3))" }} />
                                <div className="text-base text-white font-bold capitalize" style={{ filter: "drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5))" }}>{weather}</div>

                                {isHoveringWeather && (
                                    <div
                                        className="absolute top-full mt-2 text-sm px-3 py-2 whitespace-nowrap z-50 font-bold pointer-events-none"
                                        style={{
                                            backgroundColor: "#D4A574",
                                            border: "3px solid #8B4513",
                                            color: "#9e4539",
                                            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                                            imageRendering: "pixelated",
                                            transform: "none",
                                            animation: "none",
                                        }}
                                    >
                                        {getWeatherDescription()}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className="flex flex-row items-center gap-3">
                                <div className="text-5xl font-bold" style={{ color: "#daa87c", filter: "drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5))" }}>{userEmail.split('@')[0]}</div>
                                <button
                                    onClick={async () => {
                                        await onSignOut();
                                    }}
                                    className="hover:opacity-70 transition-opacity flex items-center justify-center"
                                    title="Sign Out"
                                >
                                    <img
                                        src="/Sprites/UI/signout.png"
                                        alt="Sign Out"
                                        className="image-pixelated w-9 h-auto"
                                        style={{ filter: "drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5))", imageRendering: "pixelated" }}
                                        draggable={false}
                                    />
                                </button>
                            </div>
                            <div className="text-4xl text-white font-bold" style={{ filter: "drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5))" }}>${Math.round(displayedMoney)}</div>
                        </div>
                    </div>
                    <div className="p-8 flex flex-row justify-between items-end">
                        <div className="flex flex-row gap-4 items-end">
                            {tools
                                .filter((tool) => tool.type === "Spade")
                                .map((tool) => {
                                    const showDollarSign = tool.type === "Spade" && attachedSproutId;
                                    const displayImage = showDollarSign ? "/Sprites/UI/dollarsign.png" : tool.image;

                                    return (
                                        <div key={tool.id} className="relative w-fit h-fit flex flex-col items-center gap-1">
                                            <div className="relative w-fit h-fit">
                                                <img src="/Sprites/UI/SpadeUI.png" className="image-pixelated w-[100px] h-auto" alt="tool ui background" draggable={false} />
                                                <div
                                                    onMouseDown={!attachedSproutId ? handleToolMouseDown(tool) : undefined}
                                                    onClick={!attachedSproutId ? handleToolClick(tool) : undefined}
                                                    onMouseEnter={() => {
                                                        if (showDollarSign) {
                                                            setIsHoveringDollarSign(true);
                                                        } else if (!attachedSproutId) {
                                                            playSound("/Audio/interact.mp3");
                                                            setHoveredToolId(tool.id);
                                                        }
                                                    }}
                                                    onMouseLeave={() => {
                                                        if (showDollarSign) setIsHoveringDollarSign(false);
                                                        setHoveredToolId(null);
                                                    }}
                                                    className={`absolute inset-0 flex justify-center items-center active:scale-95 transition-all ${attachedSproutId && !showDollarSign ? "opacity-30 cursor-not-allowed" : showDollarSign ? "opacity-100 cursor-pointer" : draggedTool?.id === tool.id || selectedTool?.id === tool.id ? "opacity-50 cursor-grab active:cursor-grabbing" : "opacity-100 cursor-grab active:cursor-grabbing"} ${!draggedTool && !attachedSproutId ? "wiggle-hover" : ""} ${showDollarSign ? "wiggle-hover" : ""}`}
                                                    style={{
                                                        pointerEvents: attachedSproutId && !showDollarSign ? "none" : "auto",
                                                    }}
                                                >
                                                    <img src={displayImage} className="h-12 w-auto image-pixelated object-contain pointer-events-none" draggable={false} alt={showDollarSign ? "Sell sprout" : `${tool.type} tool`} style={{ filter: "drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.3))" }} />
                                                </div>
                                            </div>
                                            {tool.price && !showDollarSign && <div className="text-base text-white font-bold">${tool.price}</div>}

                                            {hoveredToolId === tool.id && !showDollarSign && !attachedSproutId && (
                                                <div
                                                    className="absolute bottom-full mb-2 text-sm px-3 py-2 whitespace-nowrap z-50 font-bold pointer-events-none"
                                                    style={{
                                                        backgroundColor: "#D4A574",
                                                        border: "3px solid #8B4513",
                                                        color: "#9e4539",
                                                        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                                                        imageRendering: "pixelated",
                                                        transform: "none",
                                                        animation: "none",
                                                    }}
                                                >
                                                    Move and sell plants
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            <div className="text-xl text-white font-bold relative" onMouseEnter={() => setIsHoveringPlantCount(true)} onMouseLeave={() => setIsHoveringPlantCount(false)}>
                                {placedSprouts.length}/{inventoryLimit}
                                {isHoveringPlantCount && (
                                    <div
                                        className="absolute bottom-full mb-2 text-sm px-3 py-2 whitespace-nowrap z-50 font-bold pointer-events-none"
                                        style={{
                                            backgroundColor: "#D4A574",
                                            border: "3px solid #8B4513",
                                            color: "#9e4539",
                                            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                                            imageRendering: "pixelated",
                                            transform: "none",
                                            animation: "none",
                                        }}
                                    >
                                        Plants Planted / Max Plants
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-row gap-4 items-end">
                            {/* Pomodoro/Break button */}
                            {pomodoroMode === "none" && (
                                <button
                                    onClick={handleStartPomodoro}
                                    onMouseEnter={() => playSound("/Audio/interact.mp3")}
                                    className="px-6 py-3 text-xl font-bold text-white transition-all active:scale-95 wiggle-hover"
                                    style={{
                                        backgroundColor: "#D4A574",
                                        border: "3px solid #8B4513",
                                        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                                        imageRendering: "pixelated",
                                    }}
                                >
                                    Start Pomodoro Session
                                </button>
                            )}

                            {/* Small break timer in bottom right */}
                            {pomodoroMode === "break" && (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="text-3xl font-bold text-white" style={{ filter: "drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5))" }}>
                                        Break #{currentBreakNumber} {currentBreakNumber % 4 === 0 ? "(Long)" : "(Short)"}
                                    </div>
                                    <div className="text-7xl font-bold text-white" style={{ filter: "drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5))" }}>{formatTime(breakTime)}</div>
                                    {breakTime === 0 ? (
                                        <button
                                            onClick={handleClaimBreakReward}
                                            onMouseEnter={() => !isClaimingReward && playSound("/Audio/interact.mp3")}
                                            disabled={isClaimingReward}
                                            className={`px-8 py-4 text-2xl font-bold text-white transition-all active:scale-95 ${isClaimingReward ? "opacity-50 cursor-not-allowed" : "wiggle-hover"}`}
                                            style={{
                                                backgroundColor: "#4CAF50",
                                                border: "3px solid #2E7D32",
                                                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                                                imageRendering: "pixelated",
                                            }}
                                        >
                                            {isClaimingReward ? "Claiming..." : `Continue (${Math.floor(25 * calculateIncomeMultiplier() * (currentBreakNumber % 4 === 0 ? 3 : 1))} coins)`}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setIsBreakRunning(!isBreakRunning)}
                                            onMouseEnter={() => playSound("/Audio/interact.mp3")}
                                            className="px-8 py-4 text-2xl font-bold text-white transition-all active:scale-95 wiggle-hover"
                                            style={{
                                                backgroundColor: "#D4A574",
                                                border: "3px solid #8B4513",
                                                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                                                imageRendering: "pixelated",
                                            }}
                                        >
                                            {isBreakRunning ? "Pause" : "Start"}
                                        </button>
                                    )}
                                    {/* Exit Break button - always shown */}
                                    <button
                                        onClick={handleExitPomodoro}
                                        onMouseEnter={() => playSound("/Audio/interact.mp3")}
                                        className="px-8 py-4 text-2xl font-bold text-white transition-all active:scale-95 wiggle-hover mt-2"
                                        style={{
                                            backgroundColor: "#D4A574",
                                            border: "3px solid #8B4513",
                                            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                                            imageRendering: "pixelated",
                                        }}
                                    >
                                        Exit Pomodoro Session
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Big Pomodoro Timer Overlay */}
                {pomodoroMode === "work" && (
                    <>
                        {/* Translucent gray overlay that blocks interaction */}
                        <div
                            className="fixed inset-0"
                            style={{
                                zIndex: 10003,
                                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                pointerEvents: 'auto',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />

                        {/* Pomodoro timer display */}
                        <div
                            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-6"
                            style={{ zIndex: 10004 }}
                        >
                            <div className="text-6xl font-bold text-white">Pomodoro #{currentPomodoroNumber}</div>
                            <div className="text-9xl font-bold text-white">{formatTime(pomodoroTime)}</div>

                            {pomodoroCompleted ? (
                                <button
                                    onClick={handleClaimPomodoroReward}
                                    onMouseEnter={() => playSound("/Audio/interact.mp3")}
                                    disabled={isClaimingReward}
                                    className={`px-8 py-4 text-3xl font-bold text-white transition-all active:scale-95 ${isClaimingReward ? "opacity-50 cursor-not-allowed" : "wiggle-hover"}`}
                                    style={{
                                        backgroundColor: "#4CAF50",
                                        border: "3px solid #2E7D32",
                                        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.5)",
                                        imageRendering: "pixelated",
                                    }}
                                >
                                    {isClaimingReward ? "Claiming..." : `Claim ${Math.floor(125 * calculateIncomeMultiplier())} coins`}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsPomodoroRunning(!isPomodoroRunning)}
                                    onMouseEnter={() => playSound("/Audio/interact.mp3")}
                                    className="px-8 py-4 text-3xl font-bold text-white transition-all active:scale-95 wiggle-hover"
                                    style={{
                                        backgroundColor: "#D4A574",
                                        border: "3px solid #8B4513",
                                        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.5)",
                                        imageRendering: "pixelated",
                                    }}
                                >
                                    {isPomodoroRunning ? "Pause" : "Start"}
                                </button>
                            )}

                            {/* Exit Pomodoro button - centered under pause/start */}
                            <button
                                onClick={handleExitPomodoro}
                                onMouseEnter={() => playSound("/Audio/interact.mp3")}
                                className="px-6 py-3 text-xl font-bold text-white transition-all active:scale-95 wiggle-hover"
                                style={{
                                    backgroundColor: "#D4A574",
                                    border: "3px solid #8B4513",
                                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                                    imageRendering: "pixelated",
                                }}
                            >
                                Exit Pomodoro Session
                            </button>
                        </div>
                    </>
                )}
            </main>
        </>
    );
}

export default App;
