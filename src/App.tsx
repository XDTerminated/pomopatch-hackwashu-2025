import { useState, useEffect, memo } from "react";
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
    initialPlants?: Plant[];
    userEmail: string;
    getAuthToken: () => Promise<string | null>;
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

function App({ initialMoney = 100, initialPlantLimit = 50, initialPlants = [], userEmail, getAuthToken }: AppProps) {
    const [greetMsg, setGreetMsg] = useState("");
    const [name, setName] = useState("");
    const [draggedSeed, setDraggedSeed] = useState<SeedPacket | null>(null);
    const [draggedTool, setDraggedTool] = useState<Tool | null>(null);
    const [isDraggingOverBackground, setIsDraggingOverBackground] = useState(false);
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
    const [money, setMoney] = useState(initialMoney);
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
    const [rainDrops, setRainDrops] = useState<RainDrop[]>([]);
    const [weather, setWeather] = useState<WeatherType>(() => {
        const weatherTypes: WeatherType[] = ["sunny", "rainy", "cloudy"];
        return weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
    });
    const [toolParticles, setToolParticles] = useState<ToolParticle[]>([]);
    const [hoveredPacketId, setHoveredPacketId] = useState<string | null>(null);
    const [customCursorPosition, setCustomCursorPosition] = useState({ x: 0, y: 0 });
    const [isHoveringWeather, setIsHoveringWeather] = useState(false);
    const [hoveredToolId, setHoveredToolId] = useState<string | null>(null);
    const [displayedMoney, setDisplayedMoney] = useState(initialMoney);
    const [inventoryLimit, setInventoryLimit] = useState(initialPlantLimit);
    const [isHoveringPlantCount, setIsHoveringPlantCount] = useState(false);
    const [lightning, setLightning] = useState<Lightning | null>(null);

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
        const audio = new Audio("/Audio/rain.mp3");
        audio.loop = true;
        audio.volume = 0;

        const playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log("Rain audio started successfully");
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
        const audio = new Audio("/Audio/birds.mp3");
        audio.loop = true;
        audio.volume = 0;

        const playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log("Birds audio started successfully");
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

    // Change weather randomly at random intervals
    useEffect(() => {
        const scheduleNextWeatherChange = () => {
            const weatherTypes: WeatherType[] = ["sunny", "rainy", "cloudy"];
            const randomWeather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
            const randomInterval = Math.random() * 40000 + 20000;

            const timeout = setTimeout(() => {
                setWeather(randomWeather);
                scheduleNextWeatherChange();
            }, randomInterval);

            return timeout;
        };

        const timeout = scheduleNextWeatherChange();
        return () => clearTimeout(timeout);
    }, []);

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

        const duration = 500;
        const steps = 20;
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

    // Periodic backend sync - fetch all plant data from backend every 5 seconds
    useEffect(() => {
        const syncWithBackend = async () => {
            try {
                const token = await getAuthToken();
                if (!token) return;

                const plants = await apiService.getUserPlants(userEmail, token);

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

        // Initial sync
        syncWithBackend();

        // Sync every 5 seconds
        const interval = setInterval(syncWithBackend, 5000);

        return () => clearInterval(interval);
    }, [userEmail, getAuthToken]);

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
        console.log("🌱 Mouse down on seed:", seed.type);
        setDraggedSeed(seed);
        setDragPosition({ x: e.clientX, y: e.clientY });
        setIsDraggingOverBackground(true);
        setMouseDownTime(Date.now());
    };

    const handleToolMouseDown = (tool: Tool) => (e: React.MouseEvent) => {
        console.log("🔧 Mouse down on tool:", tool.type);
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
        if (y < 200 && x < 450) return true;
        if (y < 200 && x > window.innerWidth - 350) return true;
        if (y > window.innerHeight - 200 && x < 550) return true;
        if (y > window.innerHeight - 200 && x > window.innerWidth - 350) return true;
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
                    setMoney(currentMoney - draggedSeed.price);
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
                            // Update with complete backend data
                            setPlacedSprouts((prev) =>
                                prev.map((s) =>
                                    s.id === tempSproutId
                                        ? {
                                              ...s,
                                              id: realSproutId,
                                              species: response.plant_species,
                                              rarity: response.rarity,
                                              growth_time_remaining: null, // Backend returns this as null for new plants
                                          }
                                        : s
                                )
                            );
                            setMoney(response.new_balance);
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

                        if (growthTimeRemaining !== null) {
                            console.log("🌿 Cannot fertilize - plant is still growing (time remaining:", growthTimeRemaining, ")");
                            playSound("/Audio/error.mp3");
                            setHoveredSproutId(null);
                            return;
                        }

                        const fertilizerCost = draggedTool.price || 30;
                        const currentMoney = money;

                        console.log("🌿 Fertilizing plant:", { plantId, currentMoney: money, fertilizerCost, newMoney: money - fertilizerCost });

                        // Optimistic update - update client side first for instant feedback
                        setMoney(money - fertilizerCost);
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
                        setHoveredSproutId(null);

                        // Get fresh token before API call
                        getAuthToken().then((token) => {
                            if (token) {
                                apiService
                                    .applyFertilizer(userEmail, plantId, token)
                                    .then((response) => {
                                        console.log("🌿 Fertilizer applied successfully:", response);
                                        // Update local plant state with backend response
                                        setPlacedSprouts((prev) =>
                                            prev.map((s) =>
                                                s.id === hoveredSproutId
                                                    ? {
                                                          ...s,
                                                          growth_time_remaining: response.growth_time_remaining,
                                                          fertilizer_remaining: response.fertilizer_remaining,
                                                      }
                                                    : s
                                            )
                                        );
                                        setMoney(response.new_money);
                                    })
                                    .catch((error) => {
                                        console.error("❌ Failed to apply fertilizer:", error);
                                        // Rollback on error
                                        setMoney(currentMoney);
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
                        const currentMoney = money;

                        console.log("💧 Watering plant:", { plantId, currentMoney: money, waterCost, newMoney: money - waterCost });

                        // Optimistic update - update client side first for instant feedback
                        setMoney(money - waterCost);
                        setPlacedSprouts((prev) =>
                            prev.map((s) =>
                                s.id === hoveredSproutId
                                    ? {
                                          ...s,
                                          growth_time_remaining: 30, // STAGE_0_GROWTH_TIME from backend
                                      }
                                    : s
                            )
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
                        setHoveredSproutId(null);

                        // Get fresh token before API call
                        getAuthToken().then((token) => {
                            if (token) {
                                apiService
                                    .applyWater(userEmail, plantId, token)
                                    .then((response) => {
                                        console.log("💧 Water applied successfully:", response);
                                        // Update with actual backend values to ensure sync
                                        setPlacedSprouts((prev) =>
                                            prev.map((s) =>
                                                s.id === hoveredSproutId
                                                    ? {
                                                          ...s,
                                                          growth_time_remaining: response.growth_time_remaining,
                                                      }
                                                    : s
                                            )
                                        );
                                        setMoney(response.new_money);
                                    })
                                    .catch((error) => {
                                        console.error("❌ Failed to apply water:", error);
                                        // Rollback on error
                                        setMoney(currentMoney);
                                        setPlacedSprouts((prev) =>
                                            prev.map((s) =>
                                                s.id === hoveredSproutId
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
                    if (!attachedSproutId) {
                        playSound("/Audio/error.mp3");
                    }
                }
            }

            setDraggedSeed(null);
            setDraggedTool(null);
            setIsDraggingOverBackground(false);
            setHoveredSproutId(null);
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        const timeSinceMouseDown = Date.now() - mouseDownTime;
        const timeSinceSproutAttached = Date.now() - sproutAttachedTime;
        console.log("🖱️ Click event", {
            timeSinceMouseDown,
            timeSinceSproutAttached,
            attachedSproutId,
        });

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

                    setPlacedSprouts(placedSprouts.filter((s) => s.id !== attachedSproutId));
                    setAttachedSproutId(null);
                    setIsHoveringDollarSign(false);
                    playSound("/Audio/sell.mp3");

                    // Get fresh token before API call
                    getAuthToken()
                        .then((token) => {
                            if (!token) throw new Error("Failed to get auth token");
                            return apiService.sellPlant(userEmail, plantId, token);
                        })
                        .then((response) => {
                            console.log("💰 Sell response:", response);
                            setMoney(response.new_balance);
                        })
                        .catch((error) => {
                            console.error("❌ Failed to sell plant:", error);
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

    return (
        <>
            <img
                src={draggedSeed || draggedTool || attachedSproutId ? "/Sprites/UI/cursorgrab.png" : "/Sprites/UI/cursor.png"}
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
                                    filter: hasCollision || inUIArea ? "sepia(100%) saturate(500%) hue-rotate(-50deg) brightness(0.8)" : isHovered && !isAttached ? "brightness(1.3)" : "none",
                                    transition: isAttached ? "none" : "all 0.3s",
                                    animation: isAttached ? "shake 0.15s ease-in-out infinite" : isNewlyPlaced ? "settle 0.4s ease-out" : "none",
                                }}
                            />
                            {isHovered && !isAttached && (
                                <div
                                    className="absolute bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                                    style={{
                                        left: "50%",
                                        top: "-60px",
                                        transform: "translateX(-50%)",
                                        zIndex: 10000,
                                        pointerEvents: "none",
                                    }}
                                >
                                    <div className="flex flex-col gap-1">
                                        {/* Plant Type & Species */}
                                        <div className="text-white font-bold">
                                            {sprout.seedType} - {sprout.species || "Unknown"}
                                        </div>

                                        {/* Rarity */}
                                        {sprout.rarity !== undefined && (
                                            <div className={sprout.rarity === 0 ? "text-gray-300" : sprout.rarity === 1 ? "text-purple-400" : "text-yellow-400"}>
                                                ★ {sprout.rarity === 0 ? "Common" : sprout.rarity === 1 ? "Epic" : "Legendary"}
                                            </div>
                                        )}

                                        {/* Stage */}
                                        <div className="text-purple-400">
                                            🌿 Stage {stage ?? 0}
                                        </div>

                                        {/* Growth Timer - show in minutes */}
                                        {growthTime !== null && growthTime !== undefined && growthTime > 0 && (
                                            <div className="text-blue-400">
                                                🕐 {Math.ceil(growthTime / 60)} min
                                            </div>
                                        )}

                                        {/* Fertilizer - show if backend says it needs fertilizer */}
                                        {fertilizerNeeded !== null && fertilizerNeeded !== undefined && fertilizerNeeded > 0 && (
                                            <div className="text-yellow-400">
                                                🌱 Needs {fertilizerNeeded} Fertilizer{fertilizerNeeded !== 1 ? "s" : ""}
                                            </div>
                                        )}

                                        {/* Water status - only for stage 0 */}
                                        {stage === 0 && (
                                            <div className={growthTime === null ? "text-green-400" : "text-gray-400"}>
                                                💧 {growthTime === null ? "Needs Water" : "Watered"}
                                            </div>
                                        )}

                                        {/* Fully grown indicator */}
                                        {stage === 2 && (
                                            <div className="text-green-400">
                                                ✨ Ready to Sell!
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

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
                        <div className="flex flex-row gap-4 items-center">
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
                                                onMouseEnter={() => {
                                                    if (canAfford) {
                                                        playSound("/Audio/interact.mp3");
                                                        setHoveredPacketId(seed.id);
                                                    }
                                                }}
                                                onMouseLeave={() => setHoveredPacketId(null)}
                                                className={`size-16 flex justify-center items-center flex-col gap-0.5 transition-all ${draggedSeed?.id === seed.id ? "opacity-50 cursor-grab active:cursor-grabbing active:scale-95" : canAfford ? "opacity-100 cursor-grab active:cursor-grabbing active:scale-95" : "opacity-30 cursor-not-allowed"} ${!draggedSeed && canAfford ? "wiggle-hover" : ""}`}
                                                style={{
                                                    filter: !canAfford ? "grayscale(100%)" : "none",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <img src={seed.image} className="w-fit h-full image-pixelated object-contain pointer-events-none" alt={`${seed.type} packet`} draggable={false} />
                                                {seed.id === "berry" && isHovered && (
                                                    <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                                                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "-50%" }}>
                                                            <img src="/Sprites/berry/blueberry_2.png" className="w-12 h-12 image-pixelated object-cover" alt="berry blue" draggable={false} style={{ width: "48px", height: "48px" }} />
                                                            <div className="text-xs text-white font-bold whitespace-nowrap">79%</div>
                                                        </div>
                                                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "50%", transform: "translateX(-50%)" }}>
                                                            <img src="/Sprites/berry/strawberry_2.png" className="w-12 h-12 image-pixelated object-cover" alt="berry straw" draggable={false} style={{ width: "48px", height: "48px" }} />
                                                            <div className="text-xs text-white font-bold whitespace-nowrap">20%</div>
                                                        </div>
                                                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", right: "-50%" }}>
                                                            <img src="/Sprites/berry/ancient_fruit_2.png" className="w-12 h-12 image-pixelated object-cover" alt="berry ancient" draggable={false} style={{ width: "48px", height: "48px" }} />
                                                            <div className="text-xs text-white font-bold whitespace-nowrap">1%</div>
                                                        </div>
                                                    </div>
                                                )}
                                                {seed.id === "fungi" && isHovered && (
                                                    <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                                                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "-50%" }}>
                                                            <img src="/Sprites/fungi/brown_mushroom_2.png" className="w-12 h-12 image-pixelated object-cover" alt="brown mushroom" draggable={false} style={{ width: "48px", height: "48px" }} />
                                                            <div className="text-xs text-white font-bold whitespace-nowrap">79%</div>
                                                        </div>
                                                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "50%", transform: "translateX(-50%)" }}>
                                                            <img src="/Sprites/fungi/red_mushroom_2.png" className="w-12 h-12 image-pixelated object-cover" alt="red mushroom" draggable={false} style={{ width: "48px", height: "48px" }} />
                                                            <div className="text-xs text-white font-bold whitespace-nowrap">20%</div>
                                                        </div>
                                                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", right: "-50%" }}>
                                                            <img src="/Sprites/fungi/mario_mushroom_2.png" className="w-12 h-12 image-pixelated object-cover" alt="mario mushroom" draggable={false} style={{ width: "48px", height: "48px" }} />
                                                            <div className="text-xs text-white font-bold whitespace-nowrap">1%</div>
                                                        </div>
                                                    </div>
                                                )}
                                                {seed.id === "rose" && isHovered && (
                                                    <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                                                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "-90%" }}>
                                                            <img src="/Sprites/roses/red_rose_2.png" className="w-12 h-12 image-pixelated object-cover" alt="red rose" draggable={false} style={{ width: "48px", height: "48px" }} />
                                                            <div className="text-xs text-white font-bold whitespace-nowrap">79%</div>
                                                        </div>
                                                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "-30%" }}>
                                                            <img src="/Sprites/roses/pink_rose_2.png" className="w-12 h-12 image-pixelated object-cover" alt="pink rose" draggable={false} style={{ width: "48px", height: "48px" }} />
                                                            <div className="text-xs text-white font-bold whitespace-nowrap">20%</div>
                                                        </div>
                                                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "30%" }}>
                                                            <img src="/Sprites/roses/white_rose_2.png" className="w-12 h-12 image-pixelated object-cover" alt="white rose" draggable={false} style={{ width: "48px", height: "48px" }} />
                                                            <div className="text-xs text-white font-bold whitespace-nowrap">20%</div>
                                                        </div>
                                                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "110%" }}>
                                                            <img src="/Sprites/roses/withered_rose_2.png" className="w-12 h-12 image-pixelated object-cover" alt="wither rose" draggable={false} style={{ width: "48px", height: "48px" }} />
                                                            <div className="text-xs text-white font-bold whitespace-nowrap">1%</div>
                                                        </div>
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
                                                    onClick={async () => {
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
                                                    className={`size-16 flex justify-center items-center flex-col gap-0.5 transition-all relative ${tool.type === "Backpack" ? (money >= (tool.price || 0) ? "opacity-100 cursor-pointer active:scale-95" : "opacity-30 cursor-not-allowed") : draggedTool?.id === tool.id ? "opacity-50 cursor-grab active:cursor-grabbing active:scale-95" : attachedSproutId ? "opacity-30 cursor-not-allowed" : "opacity-100 cursor-grab active:cursor-grabbing active:scale-95"} ${!draggedTool && !attachedSproutId && (tool.type === "Backpack" ? money >= (tool.price || 0) : true) ? "wiggle-hover" : ""}`}
                                                    style={{
                                                        pointerEvents: tool.type === "Backpack" ? "auto" : attachedSproutId ? "none" : "auto",
                                                        filter: tool.type === "Backpack" && money < (tool.price || 0) ? "grayscale(100%)" : "none",
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    <div className="h-full flex items-center justify-center">
                                                        <img src={tool.image} className={`image-pixelated object-contain pointer-events-none ${tool.type === "Backpack" ? "w-10 h-10" : "w-fit h-full"}`} alt={`${tool.type} tool`} draggable={false} />
                                                    </div>
                                                    <div className="text-sm pointer-events-none font-bold" style={{ color: "#9e4539" }}>
                                                        ${tool.price}
                                                    </div>

                                                    {hoveredToolId === tool.id && (tool.type !== "Backpack" ? !attachedSproutId : true) && (
                                                        <div
                                                            className="absolute top-full mt-2 text-sm px-3 py-2 whitespace-nowrap z-50 font-bold"
                                                            style={{
                                                                backgroundColor: "#D4A574",
                                                                border: "3px solid #8B4513",
                                                                color: "#9e4539",
                                                                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                                                                imageRendering: "pixelated",
                                                            }}
                                                        >
                                                            {tool.type === "WateringCan" && "Turn seedlings into sprouts"}
                                                            {tool.type === "Fertilizer" && "Turn sprouts into plants"}
                                                            {tool.type === "Backpack" && `Max Plants Upgrade (+25 slots)`}
                                                        </div>
                                                    )}
                                                </li>
                                            );
                                        })}
                                </ol>
                            </div>

                            <div className="flex flex-col items-center gap-1 relative" onMouseEnter={() => setIsHoveringWeather(true)} onMouseLeave={() => setIsHoveringWeather(false)}>
                                <img src={getWeatherIcon()} alt={`${weather} weather`} className="image-pixelated w-12 h-12 object-contain" draggable={false} />
                                <div className="text-xs text-white font-bold capitalize">{weather}</div>

                                {isHoveringWeather && (
                                    <div
                                        className="absolute top-full mt-2 text-sm px-3 py-2 whitespace-nowrap z-50 font-bold"
                                        style={{
                                            backgroundColor: "#D4A574",
                                            border: "3px solid #8B4513",
                                            color: "#9e4539",
                                            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                                            imageRendering: "pixelated",
                                        }}
                                    >
                                        {getWeatherDescription()}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <div className="text-5xl text-white font-bold">${Math.round(displayedMoney)}</div>
                        </div>
                    </div>
                    <div className="p-8 flex flex-row justify-between items-center">
                        <div className="flex flex-row gap-4 items-center">
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
                                                    className={`absolute inset-0 flex justify-center items-center active:scale-95 transition-all ${attachedSproutId && !showDollarSign ? "opacity-30 cursor-not-allowed" : showDollarSign ? "opacity-100 cursor-pointer" : draggedTool?.id === tool.id ? "opacity-50 cursor-grab active:cursor-grabbing" : "opacity-100 cursor-grab active:cursor-grabbing"} ${!draggedTool && !attachedSproutId ? "wiggle-hover" : ""} ${showDollarSign ? "wiggle-hover" : ""}`}
                                                    style={{
                                                        pointerEvents: attachedSproutId && !showDollarSign ? "none" : "auto",
                                                    }}
                                                >
                                                    <img src={displayImage} className="h-12 w-auto image-pixelated object-contain pointer-events-none" draggable={false} alt={showDollarSign ? "Sell sprout" : `${tool.type} tool`} />
                                                </div>
                                            </div>
                                            {tool.price && !showDollarSign && <div className="text-base text-white font-bold">${tool.price}</div>}

                                            {hoveredToolId === tool.id && !showDollarSign && !attachedSproutId && (
                                                <div
                                                    className="absolute bottom-full mb-2 text-sm px-3 py-2 whitespace-nowrap z-50 font-bold"
                                                    style={{
                                                        backgroundColor: "#D4A574",
                                                        border: "3px solid #8B4513",
                                                        color: "#9e4539",
                                                        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                                                        imageRendering: "pixelated",
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
                                        className="absolute bottom-full mb-2 text-sm px-3 py-2 whitespace-nowrap z-50 font-bold"
                                        style={{
                                            backgroundColor: "#D4A574",
                                            border: "3px solid #8B4513",
                                            color: "#9e4539",
                                            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                                            imageRendering: "pixelated",
                                        }}
                                    >
                                        Plants in inventory
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="text-5xl text-white font-bold">5:00</div>
                    </div>
                </div>
            </main>
        </>
    );
}

export default App;
