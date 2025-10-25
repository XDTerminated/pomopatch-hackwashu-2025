import { useState, useEffect, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./globals.css";

type SeedType = "Berry" | "Fungi" | "Rose";
type ToolType = "Spade" | "WateringCan" | "Fertilizer";
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
  price?: number; // Optional price (spade is free, others cost money)
}

interface PlacedSprout {
  id: string;
  x: number;
  y: number;
  seedType: SeedType;
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
            animation: `rainFall ${1.5 + Math.random() * 0.5}s linear infinite`,
            animationDelay: `${drop.delay}s`,
            zIndex: 10001,
          }}
        />
      ))}
    </>
  );
});

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [draggedSeed, setDraggedSeed] = useState<SeedPacket | null>(null);
  const [draggedTool, setDraggedTool] = useState<Tool | null>(null);
  const [isDraggingOverBackground, setIsDraggingOverBackground] =
    useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [money, setMoney] = useState(100);
  const [placedSprouts, setPlacedSprouts] = useState<PlacedSprout[]>([]);
  const [hoveredSproutId, setHoveredSproutId] = useState<string | null>(null);
  const [attachedSproutId, setAttachedSproutId] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [isHoveringDollarSign, setIsHoveringDollarSign] = useState(false);
  const [coinParticles, setCoinParticles] = useState<CoinParticle[]>([]);
  const [trailParticles, setTrailParticles] = useState<TrailParticle[]>([]);
  const [mouseDownTime, setMouseDownTime] = useState(0);
  const [sproutAttachedTime, setSproutAttachedTime] = useState(0);
  const [newlyPlacedSproutId, setNewlyPlacedSproutId] = useState<string | null>(
    null
  );
  const [lastCursorPosition, setLastCursorPosition] = useState({ x: 0, y: 0 });
  const [wobbleAudio, setWobbleAudio] = useState<HTMLAudioElement | null>(null);
  const [rainDrops, setRainDrops] = useState<RainDrop[]>([]);
  const [weather, setWeather] = useState<WeatherType>("rainy");
  const [toolParticles, setToolParticles] = useState<ToolParticle[]>([]);
  const [hoveredPacketId, setHoveredPacketId] = useState<string | null>(null);
  const [customCursorPosition, setCustomCursorPosition] = useState({ x: 0, y: 0 });

  // Function to play sounds
  const playSound = (soundPath: string) => {
    const audio = new Audio(soundPath);
    audio.volume = 0.5; // Set volume to 50%
    audio
      .play()
      .catch((error) =>
        console.error("Audio play failed:", error, "Path:", soundPath)
      );
  };

  // Handle wobble sound when sprout is attached
  useEffect(() => {
    if (attachedSproutId) {
      // Create and play wobble sound on loop
      const audio = new Audio("/Audio/wobble.mp3");
      audio.volume = 0.02;
      audio.loop = true;
      audio
        .play()
        .catch((error) => console.error("Wobble audio play failed:", error));
      setWobbleAudio(audio);

      // Cleanup: stop audio when sprout is released
      return () => {
        audio.pause();
        audio.currentTime = 0;
        setWobbleAudio(null);
      };
    }
  }, [attachedSproutId]);

  // Generate rain drops when weather changes
  useEffect(() => {
    if (weather === "rainy") {
      const drops: RainDrop[] = [];
      for (let i = 0; i < 50; i++) {
        drops.push({
          id: `rain-${i}`,
          x: Math.random() * 100, // percentage
          delay: Math.random() * 2 - 2, // Negative delay to start mid-animation
        });
      }
      setRainDrops(drops);
    } else {
      setRainDrops([]);
    }
  }, [weather]);

  // Change weather randomly every 60 seconds (simulating timer cycles)
  useEffect(() => {
    const changeWeather = () => {
      const weatherTypes: WeatherType[] = ["sunny", "rainy", "cloudy"];
      const randomWeather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
      setWeather(randomWeather);
    };

    // Change weather every 60 seconds
    const interval = setInterval(changeWeather, 60000);

    return () => clearInterval(interval);
  }, []);

  const seedPackets: SeedPacket[] = [
    {
      id: "berry",
      type: "Berry",
      image: "/Sprites/UI/berryPacket.png",
      price: 10,
    },
    {
      id: "fungi",
      type: "Fungi",
      image: "/Sprites/UI/fungiPacket.png",
      price: 15,
    },
    {
      id: "rose",
      type: "Rose",
      image: "/Sprites/UI/rosePacket.png",
      price: 20,
    },
  ];

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
      price: 30,
    },
  ];

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  // Mouse-based drag handlers for seeds
  const handleSeedMouseDown = (seed: SeedPacket) => () => {
    console.log("🌱 Mouse down on seed:", seed.type);
    setDraggedSeed(seed);
    setIsDraggingOverBackground(true);
    setMouseDownTime(Date.now());
  };

  // Mouse-based drag handlers for tools
  const handleToolMouseDown = (tool: Tool) => () => {
    console.log("🔧 Mouse down on tool:", tool.type);
    setDraggedTool(tool);
    setMouseDownTime(Date.now());

    // Play tool-specific sound when starting to drag
    if (tool.type === "Spade") {
      playSound("/Audio/spadeclink.mp3");
    } else if (tool.type === "WateringCan") {
      playSound("/Audio/wateringcan.mp3");
    } else if (tool.type === "Fertilizer") {
      playSound("/Audio/fertilizerDrag.mp3");
    }
  };

  const findSproutAtPosition = (x: number, y: number): string | null => {
    // Check if any sprout is within 48px (half of 96px width) of the cursor
    const sprout = placedSprouts.find((s) => {
      const dx = Math.abs(s.x - x);
      const dy = Math.abs(s.y - y);
      return dx < 48 && dy < 48;
    });
    return sprout ? sprout.id : null;
  };

  const checkCollision = (
    x: number,
    y: number,
    excludeId?: string
  ): boolean => {
    // Check if position collides with any other sprout (within 30px - allows very close placement)
    return placedSprouts.some((s) => {
      if (excludeId && s.id === excludeId) return false; // Exclude the sprout being moved
      const dx = Math.abs(s.x - x);
      const dy = Math.abs(s.y - y);
      return dx < 30 && dy < 30; // Allow sprouts to be placed very close together
    });
  };

  const isInUIArea = (x: number, y: number): boolean => {
    // Define UI exclusion zones - generously sized to ensure no overlap with UI

    // Top left - seed packets area
    // Block 0-450px wide, top 200px
    if (y < 200 && x < 450) return true;

    // Top right - money display
    // Block last 350px, top 200px
    if (y < 200 && x > window.innerWidth - 350) return true;

    // Bottom left - tools area (spade, watering can, fertilizer)
    // Block 0-550px wide, bottom 200px
    if (y > window.innerHeight - 200 && x < 550) return true;

    // Bottom right - timer
    // Block last 350px, bottom 200px
    if (y > window.innerHeight - 200 && x > window.innerWidth - 350)
      return true;

    return false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const newPosition = { x: e.clientX, y: e.clientY };
    setCursorPosition(newPosition);
    setCustomCursorPosition(newPosition);

    // Create trail particles when dragging attached sprout
    if (attachedSproutId) {
      const distance = Math.sqrt(
        Math.pow(newPosition.x - lastCursorPosition.x, 2) +
          Math.pow(newPosition.y - lastCursorPosition.y, 2)
      );

      // Only create trail if cursor moved enough
      if (distance > 10) {
        // Create multiple particles with slight randomization
        const particleCount = 2;
        const newTrails: TrailParticle[] = [];

        for (let i = 0; i < particleCount; i++) {
          const offsetX = (Math.random() - 0.5) * 20;
          const offsetY = (Math.random() - 0.5) * 20;
          const trailId = `trail-${Date.now()}-${i}`;
          const size = Math.floor(Math.random() * 3) + 3; // Random size between 3-5px

          newTrails.push({
            id: trailId,
            x: newPosition.x + offsetX,
            y: newPosition.y + offsetY,
            size: size,
          });

          // Remove trail particle after animation
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
      // Check if tool is over a sprout
      const sproutId = findSproutAtPosition(e.clientX, e.clientY);
      setHoveredSproutId(sproutId);
    }
  };

  const handleGlobalMouseUp = () => {
    // Only handle mouse up if we're dragging something NEW (seed or tool)
    // Don't handle if a sprout is already attached
    if ((draggedSeed || draggedTool) && !attachedSproutId) {
      console.log("🖱️ Mouse up - placing item");

      // Handle seed placement
      if (draggedSeed && money >= draggedSeed.price) {
        const hasCollision = checkCollision(cursorPosition.x, cursorPosition.y);
        const inUIArea = isInUIArea(cursorPosition.x, cursorPosition.y);

        if (!hasCollision && !inUIArea) {
          const newSproutId = `sprout-${Date.now()}`;
          setPlacedSprouts([
            ...placedSprouts,
            {
              id: newSproutId,
              x: cursorPosition.x,
              y: cursorPosition.y,
              seedType: draggedSeed.type,
            },
          ]);
          setMoney(money - draggedSeed.price);
          playSound("/Audio/placingPlant.mp3");

          // Create dirt particles when planting
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

          // Trigger settle animation
          setNewlyPlacedSproutId(newSproutId);
          setTimeout(() => setNewlyPlacedSproutId(null), 400);
        } else {
          playSound("/Audio/error.mp3");
        }
      }

      // Handle tool actions
      else if (draggedTool) {
        if (hoveredSproutId) {
          if (draggedTool.type === "Spade") {
            // Attach the sprout to cursor when spade is released
            console.log("🌱 Attaching sprout to cursor:", hoveredSproutId);
            playSound("/Audio/shovel.mp3");
            setAttachedSproutId(hoveredSproutId);
            setSproutAttachedTime(Date.now());
            setLastCursorPosition(cursorPosition);
            setHoveredSproutId(null);
          } else if (draggedTool.type === "Fertilizer") {
            // Apply fertilizer to the plant
            playSound("/Audio/fertilizerUse.mp3");

            // Create golden sparkle particles for fertilizer
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
                  color: "#FFD700", // Gold
                  velocityX: Math.cos(angle) * speed,
                  velocityY: Math.sin(angle) * speed - 2, // Rising upward
                });

                setTimeout(() => {
                  setToolParticles((prev) => prev.filter((p) => p.id !== particleId));
                }, 800);
              }
              setToolParticles((prev) => [...prev, ...newParticles]);
            }
            setHoveredSproutId(null);
          } else if (draggedTool.type === "WateringCan") {
            // Apply water to the plant
            playSound("/Audio/wateringcanuse.mp3");

            // Create blue water droplet particles
            const sprout = placedSprouts.find((s) => s.id === hoveredSproutId);
            if (sprout) {
              const particleCount = 15; // More particles
              const newParticles: ToolParticle[] = [];
              for (let i = 0; i < particleCount; i++) {
                const angle = Math.random() * Math.PI - Math.PI / 2; // Spray downward
                const speed = 2 + Math.random() * 3;
                const particleId = `water-${Date.now()}-${i}`;

                newParticles.push({
                  id: particleId,
                  x: sprout.x,
                  y: sprout.y - 30, // Start above the plant
                  size: Math.floor(Math.random() * 5) + 5, // Bigger: 5-10px
                  color: "#4A9EFF", // Blue
                  velocityX: Math.cos(angle) * speed,
                  velocityY: Math.sin(angle) * speed + 3, // Falling downward
                });

                setTimeout(() => {
                  setToolParticles((prev) => prev.filter((p) => p.id !== particleId));
                }, 800); // Last longer
              }
              setToolParticles((prev) => [...prev, ...newParticles]);
            }
            setHoveredSproutId(null);
          }
        } else {
          // Tool used on empty ground - play error sound
          playSound("/Audio/error.mp3");
        }
      }

      // Reset dragging state
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

    // If a sprout was just attached, ignore clicks for 200ms to prevent immediate placement
    if (attachedSproutId && timeSinceSproutAttached < 200) {
      console.log("❌ Ignoring click - sprout was just attached");
      return;
    }

    // Ignore clicks that happen within 100ms of mouse down (these are drag releases, not real clicks)
    if (timeSinceMouseDown < 100) {
      console.log("❌ Ignoring click - too soon after mouse down");
      return;
    }

    if (attachedSproutId) {
      console.log("✅ Processing click with attached sprout");
      // Check if clicking on dollar sign to sell sprout
      if (isHoveringDollarSign) {
        // Sell the sprout - remove it and refund half the price
        const sproutToSell = placedSprouts.find(
          (s) => s.id === attachedSproutId
        );
        if (sproutToSell) {
          const seedPrice =
            seedPackets.find((p) => p.type === sproutToSell.seedType)?.price ||
            0;
          const refund = Math.floor(seedPrice / 2);

          // Create coin particles at cursor position
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

          // Remove coins after animation
          setTimeout(() => {
            setCoinParticles((prev) =>
              prev.filter((c) => !newCoins.find((nc) => nc.id === c.id))
            );
          }, 1000);

          setMoney(money + refund);
          setPlacedSprouts(
            placedSprouts.filter((s) => s.id !== attachedSproutId)
          );
          setAttachedSproutId(null);
          setIsHoveringDollarSign(false);
          playSound("/Audio/sell.mp3");
        }
        return;
      }

      // Check for collision and UI area before placing
      const hasCollision = checkCollision(
        e.clientX,
        e.clientY,
        attachedSproutId
      );
      const inUIArea = isInUIArea(e.clientX, e.clientY);

      if (!hasCollision && !inUIArea) {
        // Only place if no collision and not in UI area
        setPlacedSprouts(
          placedSprouts.map((sprout) =>
            sprout.id === attachedSproutId
              ? { ...sprout, x: e.clientX, y: e.clientY }
              : sprout
          )
        );

        // Create dirt particles when replanting
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

        // Trigger settle animation for replanted sprout
        setNewlyPlacedSproutId(attachedSproutId);
        setTimeout(() => setNewlyPlacedSproutId(null), 400);

        setAttachedSproutId(null);
        playSound("/Audio/placingPlant.mp3");
      } else {
        // Can't place - collision or in UI area
        playSound("/Audio/error.mp3");
      }
      // If collision or in UI area, don't place and keep sprout attached
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

  return (
    <>
      {/* Custom Cursor */}
      <img
        src="/Sprites/UI/cursor.png"
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

      {/* Weather effects - Rain */}
      {weather === "rainy" && <Rain rainDrops={rainDrops} />}

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
      {/* Sunny weather tint overlay */}
      {weather === "sunny" && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: "rgba(255, 223, 128, 0.2)",
            mixBlendMode: "multiply",
            zIndex: 0,
          }}
        />
      )}

      {/* Render placed sprouts */}
      {placedSprouts.map((sprout) => {
        const isAttached = attachedSproutId === sprout.id;
        const isHovered = hoveredSproutId === sprout.id;
        const isNewlyPlaced = newlyPlacedSproutId === sprout.id;
        const hasCollision =
          isAttached &&
          checkCollision(cursorPosition.x, cursorPosition.y, sprout.id);
        const inUIArea =
          isAttached && isInUIArea(cursorPosition.x, cursorPosition.y);

        return (
          <img
            key={sprout.id}
            src="/Sprites/basicSprout.png"
            alt={`${sprout.seedType} sprout`}
            className="image-pixelated pointer-events-none absolute w-24 h-24 object-contain"
            draggable={false}
            style={{
              left: isAttached ? cursorPosition.x - 48 : sprout.x - 48,
              top: isAttached ? cursorPosition.y - 48 : sprout.y - 48,
              opacity: isAttached ? 0.7 : 1,
              filter:
                hasCollision || inUIArea
                  ? "sepia(100%) saturate(500%) hue-rotate(-50deg) brightness(0.8)"
                  : isHovered && !isAttached
                  ? "brightness(1.3)"
                  : "none",
              transition: isAttached ? "none" : "all 0.3s",
              zIndex: isAttached ? 9999 : 1,
              animation: isAttached
                ? "shake 0.15s ease-in-out infinite"
                : isNewlyPlaced
                ? "settle 0.4s ease-out"
                : "none",
            }}
          />
        );
      })}

      {/* Seed drag preview */}
      {isDraggingOverBackground &&
        draggedSeed &&
        (() => {
          const hasCollision = checkCollision(dragPosition.x, dragPosition.y);
          const inUIArea = isInUIArea(dragPosition.x, dragPosition.y);
          const canAfford = money >= draggedSeed.price;

          return (
            <div
              className="image-pixelated pointer-events-none absolute w-24 h-24"
              style={{
                left: dragPosition.x - 48,
                top: dragPosition.y - 48,
                filter:
                  hasCollision || !canAfford || inUIArea
                    ? "sepia(100%) saturate(500%) hue-rotate(-50deg) brightness(0.8)"
                    : "brightness(1.2) saturate(1.5) contrast(1.1)",
                zIndex: 9999,
              }}
            >
              <img
                src="/Sprites/basicSprout.png"
                alt="sprout preview"
                className="w-full h-full object-contain"
                draggable={false}
              />
            </div>
          );
        })()}

      {/* Tool drag preview */}
      {draggedTool &&
        !attachedSproutId &&
        (() => {
          // Calculate rotation based on cursor velocity (approximated by last position)
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

      {/* Trail particles */}
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

      {/* Tool particles (water/fertilizer) */}
      {toolParticles.map((particle) => {
        const duration = particle.color === "#FFD700" ? 0.8 : 0.6; // Gold slower, water faster
        return (
          <div
            key={particle.id}
            className="pointer-events-none absolute rounded-full"
            style={{
              left: particle.x,
              top: particle.y,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              backgroundColor: particle.color,
              animation: `toolParticleFloat ${duration}s ease-out forwards`,
              "--particle-x": `${particle.velocityX * 30}px`,
              "--particle-y": `${particle.velocityY * 30}px`,
            } as React.CSSProperties}
          />
        );
      })}

      {/* Coin particles */}
      {coinParticles.map((coin) => {
        // Calculate target position (money display is in top right)
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

      <div className="h-full w-full flex flex-col justify-between">
        <div className="flex flex-row justify-between h-fit w-full p-8">
          <div className="flex flex-row gap-4 items-center">
            <div className="relative w-fit h-fit">
              <img
                src="/Sprites/UI/PacketUI.png"
                className="image-pixelated w-[300px] h-auto"
                alt="packet ui"
                draggable={false}
              />
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
                    className={`size-16 flex justify-center items-center flex-col gap-0.5 transition-all ${
                      draggedSeed?.id === seed.id
                        ? "opacity-50 cursor-grab active:cursor-grabbing active:scale-95"
                        : canAfford
                        ? "opacity-100 cursor-grab active:cursor-grabbing active:scale-95 wiggle-hover"
                        : "opacity-30 cursor-not-allowed"
                    }`}
                    style={{
                      filter: !canAfford ? "grayscale(100%)" : "none",
                    }}
                  >
                    <img
                      src={seed.image}
                      className="w-fit h-full image-pixelated object-contain pointer-events-none"
                      alt={`${seed.type} packet`}
                      draggable={false}
                    />
                    {/* Show berry dots when hovering over berry packet */}
                    {seed.id === "berry" && isHovered && (
                      <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "-50%" }}>
                          <img
                            src="/Sprites/Berry/BerryBlue.png"
                            className="w-12 h-12 image-pixelated object-cover"
                            alt="berry blue"
                            draggable={false}
                            style={{ width: "48px", height: "48px" }}
                          />
                          <div className="text-xs text-white font-bold whitespace-nowrap">79%</div>
                        </div>
                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "50%", transform: "translateX(-50%)" }}>
                          <img
                            src="/Sprites/Berry/BerryStraw.png"
                            className="w-12 h-12 image-pixelated object-cover"
                            alt="berry straw"
                            draggable={false}
                            style={{ width: "48px", height: "48px" }}
                          />
                          <div className="text-xs text-white font-bold whitespace-nowrap">20%</div>
                        </div>
                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", right: "-50%" }}>
                          <img
                            src="/Sprites/Berry/BerryAncient.png"
                            className="w-12 h-12 image-pixelated object-cover"
                            alt="berry ancient"
                            draggable={false}
                            style={{ width: "48px", height: "48px" }}
                          />
                          <div className="text-xs text-white font-bold whitespace-nowrap">1%</div>
                        </div>
                      </div>
                    )}
                    {/* Show mushroom variants when hovering over fungi packet */}
                    {seed.id === "fungi" && isHovered && (
                      <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "-50%" }}>
                          <img
                            src="/Sprites/Mushrooms/BrownMushroom.png"
                            className="w-12 h-12 image-pixelated object-cover"
                            alt="brown mushroom"
                            draggable={false}
                            style={{ width: "48px", height: "48px" }}
                          />
                          <div className="text-xs text-white font-bold whitespace-nowrap">79%</div>
                        </div>
                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "50%", transform: "translateX(-50%)" }}>
                          <img
                            src="/Sprites/Mushrooms/RedMushroom.png"
                            className="w-12 h-12 image-pixelated object-cover"
                            alt="red mushroom"
                            draggable={false}
                            style={{ width: "48px", height: "48px" }}
                          />
                          <div className="text-xs text-white font-bold whitespace-nowrap">20%</div>
                        </div>
                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", right: "-50%" }}>
                          <img
                            src="/Sprites/Mushrooms/MarioMushroom.png"
                            className="w-12 h-12 image-pixelated object-cover"
                            alt="mario mushroom"
                            draggable={false}
                            style={{ width: "48px", height: "48px" }}
                          />
                          <div className="text-xs text-white font-bold whitespace-nowrap">1%</div>
                        </div>
                      </div>
                    )}
                    {/* Show rose variants when hovering over rose packet */}
                    {seed.id === "rose" && isHovered && (
                      <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "-90%" }}>
                          <img
                            src="/Sprites/Roses/RedRoseNew.png"
                            className="w-12 h-12 image-pixelated object-cover"
                            alt="red rose"
                            draggable={false}
                            style={{ width: "48px", height: "48px" }}
                          />
                          <div className="text-xs text-white font-bold whitespace-nowrap">79%</div>
                        </div>
                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "-30%" }}>
                          <img
                            src="/Sprites/Roses/PinkRoseNew.png"
                            className="w-12 h-12 image-pixelated object-cover"
                            alt="pink rose"
                            draggable={false}
                            style={{ width: "48px", height: "48px" }}
                          />
                          <div className="text-xs text-white font-bold whitespace-nowrap">20%</div>
                        </div>
                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "30%" }}>
                          <img
                            src="/Sprites/Roses/WhiteRoseNew.png"
                            className="w-12 h-12 image-pixelated object-cover"
                            alt="white rose"
                            draggable={false}
                            style={{ width: "48px", height: "48px" }}
                          />
                          <div className="text-xs text-white font-bold whitespace-nowrap">20%</div>
                        </div>
                        <div className="absolute flex flex-col items-center gap-1" style={{ top: "100%", left: "110%" }}>
                          <img
                            src="/Sprites/Roses/WitherRoseNew.png"
                            className="w-12 h-12 image-pixelated object-cover"
                            alt="wither rose"
                            draggable={false}
                            style={{ width: "48px", height: "48px" }}
                          />
                          <div className="text-xs text-white font-bold whitespace-nowrap">1%</div>
                        </div>
                      </div>
                    )}
                    <div className={`text-xs pointer-events-none ${!canAfford ? "text-red-600" : ""}`}>
                      ${seed.price}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          {/* Weather Icon Display */}
          <img
            src={getWeatherIcon()}
            alt={`${weather} weather`}
            className="image-pixelated w-12 h-12 object-contain"
            draggable={false}
          />
        </div>
          <div className="flex justify-center">
            <div className="text-5xl text-white font-bold">${money}</div>
          </div>
        </div>
        <div className="p-8 flex flex-row justify-between items-center">
          <div className="flex flex-row gap-4">
            {tools.map((tool) => {
              // Show dollar sign for spade when sprout is attached
              const showDollarSign = tool.type === "Spade" && attachedSproutId;
              const displayImage = showDollarSign
                ? "/Sprites/UI/dollarsign.png"
                : tool.image;

              return (
                <div
                  key={tool.id}
                  className="relative w-fit h-fit flex flex-col items-center gap-1"
                >
                  <div className="relative w-fit h-fit">
                    <img
                      src="/Sprites/UI/SpadeUI.png"
                      className="image-pixelated w-[100px] h-auto"
                      alt="tool ui background"
                      draggable={false}
                    />
                    <div
                      onMouseDown={
                        !attachedSproutId
                          ? handleToolMouseDown(tool)
                          : undefined
                      }
                      onMouseEnter={() => {
                        if (showDollarSign) {
                          setIsHoveringDollarSign(true);
                        } else if (!attachedSproutId) {
                          playSound("/Audio/interact.mp3");
                        }
                      }}
                      onMouseLeave={() => {
                        if (showDollarSign) setIsHoveringDollarSign(false);
                      }}
                      className={`absolute inset-0 flex justify-center items-center active:scale-95 transition-all ${
                        attachedSproutId && !showDollarSign
                          ? "opacity-30 cursor-not-allowed"
                          : showDollarSign
                          ? "opacity-100 cursor-pointer wiggle-hover"
                          : draggedTool?.id === tool.id
                          ? "opacity-50 cursor-grab active:cursor-grabbing"
                          : "opacity-100 cursor-grab active:cursor-grabbing wiggle-hover"
                      }`}
                      style={{
                        pointerEvents:
                          attachedSproutId && !showDollarSign ? "none" : "auto",
                      }}
                    >
                      <img
                        src={displayImage}
                        className="h-12 w-auto image-pixelated object-contain pointer-events-none"
                        draggable={false}
                        alt={
                          showDollarSign ? "Sell sprout" : `${tool.type} tool`
                        }
                      />
                    </div>
                  </div>
                  {tool.price && !showDollarSign && (
                    <div className="text-base text-white font-bold">
                      ${tool.price}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="text-5xl text-white font-bold">5:00</div>
        </div>
      </div>
    </main>
    </>
  );
}

export default App;
