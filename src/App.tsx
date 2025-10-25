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

  const handleDragStart = (seed: SeedPacket) => (e: React.DragEvent) => {
    setDraggedSeed(seed);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", seed.id);
    // Create an invisible drag image
    const img = new Image();
    img.src =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragEnd = () => {
    setDraggedSeed(null);
  };

  const handleToolDragStart = (tool: Tool) => (e: React.DragEvent) => {
    setDraggedTool(tool);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tool.id);
    // Create an invisible drag image
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleToolDragEnd = () => {
    setDraggedTool(null);
    setHoveredSproutId(null);
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

  const checkCollision = (x: number, y: number, excludeId?: string): boolean => {
    // Check if position collides with any other sprout (within 30px - allows very close placement)
    return placedSprouts.some((s) => {
      if (excludeId && s.id === excludeId) return false; // Exclude the sprout being moved
      const dx = Math.abs(s.x - x);
      const dy = Math.abs(s.y - y);
      return dx < 30 && dy < 30; // Allow sprouts to be placed very close together
    });
  };

  const isInUIArea = (x: number, y: number): boolean => {
    // Define UI exclusion zones (approximate areas where UI elements are)
    // Top area with seed packets and money (top 150px)
    if (y < 150) return true;

    // Bottom area with spade and timer (bottom 150px)
    if (y > window.innerHeight - 150) return true;

    return false;
  };

  const handleBackgroundDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedSeed) {
      setIsDraggingOverBackground(true);
      setDragPosition({ x: e.clientX, y: e.clientY });
    } else if (draggedTool) {
      setDragPosition({ x: e.clientX, y: e.clientY });
      // Check if shovel is over a sprout (just for detection, not moving yet)
      const sproutId = findSproutAtPosition(e.clientX, e.clientY);
      setHoveredSproutId(sproutId);
    }
  };

  const handleBackgroundDragLeave = () => {
    setIsDraggingOverBackground(false);
  };

  const handleBackgroundDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverBackground(false);

    if (draggedSeed && money >= draggedSeed.price) {
      // Check for collision and UI area before placing
      const hasCollision = checkCollision(e.clientX, e.clientY);
      const inUIArea = isInUIArea(e.clientX, e.clientY);

      if (!hasCollision && !inUIArea) {
        // Deduct money
        setMoney(money - draggedSeed.price);

        // Place the sprout at the drop position
        const newSprout: PlacedSprout = {
          id: `sprout-${Date.now()}`,
          x: e.clientX,
          y: e.clientY,
          seedType: draggedSeed.type,
        };

        setPlacedSprouts([...placedSprouts, newSprout]);
        playSound("/Audio/placingPlant.mp3");
      }
      // If collision or in UI area, don't place and don't deduct money
    } else if (draggedTool && hoveredSproutId) {
      // Attach the sprout to cursor when spade is released
      playSound("/Audio/shovel.mp3");
      setAttachedSproutId(hoveredSproutId);
      setHoveredSproutId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setCursorPosition({ x: e.clientX, y: e.clientY });
  };

  const handleClick = (e: React.MouseEvent) => {
    if (attachedSproutId) {
      // Check if clicking on dollar sign to sell sprout
      if (isHoveringDollarSign) {
        // Sell the sprout - remove it and refund half the price
        const sproutToSell = placedSprouts.find(s => s.id === attachedSproutId);
        if (sproutToSell) {
          const seedPrice = seedPackets.find(p => p.type === sproutToSell.seedType)?.price || 0;
          const refund = Math.floor(seedPrice / 2);

          setMoney(money + refund);
          setPlacedSprouts(placedSprouts.filter(s => s.id !== attachedSproutId));
          setAttachedSproutId(null);
          setIsHoveringDollarSign(false);
          playSound("/Audio/sell.mp3");
        }
        return;
      }

      // Check for collision and UI area before placing
      const hasCollision = checkCollision(e.clientX, e.clientY, attachedSproutId);
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
        setAttachedSproutId(null);
        playSound("/Audio/placingPlant.mp3");
      }
      // If collision or in UI area, don't place and keep sprout attached
    }
  };

  return (
    <main
      className="h-screen w-full bg-[#547E64] flex justify-center relative"
      onDragOver={handleBackgroundDragOver}
      onDragLeave={handleBackgroundDragLeave}
      onDrop={handleBackgroundDrop}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    >
      {/* Render placed sprouts */}
      {placedSprouts.map((sprout) => {
        const isAttached = attachedSproutId === sprout.id;
        const isHovered = hoveredSproutId === sprout.id;
        const hasCollision = isAttached && checkCollision(cursorPosition.x, cursorPosition.y, sprout.id);
        const inUIArea = isAttached && isInUIArea(cursorPosition.x, cursorPosition.y);

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
              filter: hasCollision || inUIArea
                ? 'sepia(100%) saturate(500%) hue-rotate(-50deg) brightness(0.8)'
                : isHovered && !isAttached
                ? 'brightness(1.3)'
                : 'none',
              transition: isAttached ? 'none' : 'all 0.3s',
              zIndex: isAttached ? 9999 : 1,
            }}
          />
        );
      })}

      {/* Seed drag preview */}
      {isDraggingOverBackground && draggedSeed && (() => {
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
      {draggedTool && (
        <img
          src={draggedTool.image}
          alt="tool preview"
          className="image-pixelated pointer-events-none absolute h-12 w-auto object-contain"
          style={{
            left: dragPosition.x - 24,
            top: dragPosition.y - 24,
            zIndex: 9999,
          }}
        />
      )}
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
                  draggable
                  onDragStart={handleDragStart(seed)}
                  onDragEnd={handleDragEnd}
                  onMouseEnter={() => playSound("/Audio/hover.mp3")}
                  className={`size-16 flex justify-center items-center flex-col gap-0.5 cursor-grab active:cursor-grabbing transition-all hover:scale-110 ${
                    draggedSeed?.id === seed.id ? "opacity-50" : "opacity-100"
                  }`}
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
              const displayImage = showDollarSign ? "/Sprites/UI/dollarsign.png" : tool.image;

              return (
                <div key={tool.id} className="relative w-fit h-fit flex flex-col items-center gap-1">
                  <div className="relative w-fit h-fit">
                    <img
                      src="/Sprites/UI/SpadeUI.png"
                      className="image-pixelated w-[100px] h-auto"
                      alt="tool ui background"
                    />
                    <div
                      draggable={!attachedSproutId}
                      onDragStart={handleToolDragStart(tool)}
                      onDragEnd={handleToolDragEnd}
                      onMouseEnter={() => {
                        if (showDollarSign) {
                          setIsHoveringDollarSign(true);
                        } else if (!attachedSproutId) {
                          playSound("/Audio/hover.mp3");
                        }
                      }}
                      onMouseLeave={() => {
                        if (showDollarSign) setIsHoveringDollarSign(false);
                      }}
                      className={`absolute inset-0 flex justify-center items-center transition-all ${
                        attachedSproutId && !showDollarSign
                          ? "opacity-30 cursor-not-allowed"
                          : showDollarSign
                          ? "opacity-100 cursor-pointer hover:scale-110"
                          : draggedTool?.id === tool.id
                          ? "opacity-50 cursor-grab active:cursor-grabbing"
                          : "opacity-100 cursor-grab active:cursor-grabbing hover:scale-110"
                      }`}
                      style={{
                        pointerEvents: attachedSproutId && !showDollarSign ? "none" : "auto",
                      }}
                    >
                      <img
                        src={displayImage}
                        className="h-12 w-auto image-pixelated object-contain pointer-events-none"
                        alt={showDollarSign ? "Sell sprout" : `${tool.type} tool`}
                      />
                    </div>
                  </div>
                  {tool.price && !showDollarSign && (
                    <div className="text-xs text-white font-bold">${tool.price}</div>
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
