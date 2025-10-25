import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./globals.css";

type SeedType = "Berry" | "Fungi" | "Rose";
type ToolType = "Spade" | "WateringCan" | "Fertilizer";

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
}

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
  const [newlyPlacedSproutId, setNewlyPlacedSproutId] = useState<string | null>(null);
  const [lastCursorPosition, setLastCursorPosition] = useState({ x: 0, y: 0 });

  // Function to play sounds
  const playSound = (soundPath: string) => {
    const audio = new Audio(soundPath);
    audio.play().catch((error) => console.log("Audio play failed:", error));
  };

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
    if (y > window.innerHeight - 200 && x > window.innerWidth - 350) return true;

    return false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const newPosition = { x: e.clientX, y: e.clientY };
    setCursorPosition(newPosition);

    // Create trail particles when dragging attached sprout
    if (attachedSproutId) {
      const distance = Math.sqrt(
        Math.pow(newPosition.x - lastCursorPosition.x, 2) +
        Math.pow(newPosition.y - lastCursorPosition.y, 2)
      );

      // Only create trail if cursor moved enough
      if (distance > 15) {
        const trailId = `trail-${Date.now()}`;
        const newTrail: TrailParticle = {
          id: trailId,
          x: newPosition.x,
          y: newPosition.y,
        };
        setTrailParticles((prev) => [...prev, newTrail]);

        // Remove trail particle after animation
        setTimeout(() => {
          setTrailParticles((prev) => prev.filter((t) => t.id !== trailId));
        }, 500);

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
            // TODO: Add fertilizer effect to the sprout
            setHoveredSproutId(null);
          } else if (draggedTool.type === "WateringCan") {
            // Apply water to the plant
            playSound("/Audio/wateringcan.mp3");
            // TODO: Add watering effect to the sprout
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
    console.log("🖱️ Click event", { timeSinceMouseDown, timeSinceSproutAttached, attachedSproutId });

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

  return (
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
              animation: isNewlyPlaced ? "settle 0.4s ease-out" : "none",
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
              />
            </div>
          );
        })()}

      {/* Tool drag preview */}
      {draggedTool && !attachedSproutId && (() => {
        // Calculate rotation based on cursor velocity (approximated by last position)
        const rotation = hoveredSproutId ? 15 : 0;
        return (
          <img
            src={draggedTool.image}
            alt="tool preview"
            className="image-pixelated pointer-events-none absolute h-12 w-auto object-contain"
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
      {trailParticles.map((trail) => (
        <img
          key={trail.id}
          src="/Sprites/basicSprout.png"
          alt="trail"
          className="image-pixelated pointer-events-none absolute w-16 h-16 object-contain"
          style={{
            left: trail.x - 32,
            top: trail.y - 32,
            zIndex: 1,
            opacity: 0.6,
            animation: "trailFade 0.5s ease-out forwards",
          }}
        />
      ))}

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
          <div className="relative w-fit h-fit">
            <img
              src="/Sprites/UI/PacketUI.png"
              className="image-pixelated w-[300px] h-auto"
              alt="packet ui"
            />
            <ol className="absolute inset-0 flex flex-row justify-between items-center gap-3 px-10">
              {seedPackets.map((seed) => (
                <li
                  key={seed.id}
                  onMouseDown={handleSeedMouseDown(seed)}
                  onMouseEnter={() => playSound("/Audio/interact.mp3")}
                  className={`size-16 flex justify-center items-center flex-col gap-0.5 cursor-grab active:cursor-grabbing active:scale-95 ${
                    draggedSeed?.id === seed.id ? "opacity-50" : "opacity-100"
                  }`}
                  style={{
                    animation: draggedSeed?.id !== seed.id ? "none" : "none",
                    transition: "all 0.15s ease-out",
                  }}
                  onMouseOver={(e) => {
                    if (draggedSeed?.id !== seed.id) {
                      e.currentTarget.style.animation = "wiggle 0.3s ease-in-out";
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.animation = "none";
                  }}
                >
                  <img
                    src={seed.image}
                    className="w-fit h-full image-pixelated object-contain pointer-events-none"
                    alt={`${seed.type} packet`}
                  />
                  <div className="text-xs pointer-events-none">
                    ${seed.price}
                  </div>
                </li>
              ))}
            </ol>
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
                    />
                    <div
                      onMouseDown={!attachedSproutId ? handleToolMouseDown(tool) : undefined}
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
                      onMouseOver={(e) => {
                        if (!attachedSproutId || showDollarSign) {
                          e.currentTarget.style.animation = "wiggle 0.3s ease-in-out";
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.animation = "none";
                      }}
                      className={`absolute inset-0 flex justify-center items-center active:scale-95 ${
                        attachedSproutId && !showDollarSign
                          ? "opacity-30 cursor-not-allowed"
                          : showDollarSign
                          ? "opacity-100 cursor-pointer"
                          : draggedTool?.id === tool.id
                          ? "opacity-50 cursor-grab active:cursor-grabbing"
                          : "opacity-100 cursor-grab active:cursor-grabbing"
                      }`}
                      style={{
                        pointerEvents:
                          attachedSproutId && !showDollarSign ? "none" : "auto",
                        transition: "all 0.15s ease-out",
                      }}
                    >
                      <img
                        src={displayImage}
                        className="h-12 w-auto image-pixelated object-contain pointer-events-none"
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
  );
}

export default App;
