import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./globals.css";

type SeedType = "Berry" | "Fungi" | "Rose";
type ToolType = "Spade";

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
}

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [draggedSeed, setDraggedSeed] = useState<SeedPacket | null>(null);
  const [draggedTool, setDraggedTool] = useState<Tool | null>(null);

  const seedPackets: SeedPacket[] = [
    { id: "berry", type: "Berry", image: "/Sprites/UI/berryPacket.png", price: 10 },
    { id: "fungi", type: "Fungi", image: "/Sprites/UI/fungiPacket.png", price: 15 },
    { id: "rose", type: "Rose", image: "/Sprites/UI/rosePacket.png", price: 20 },
  ];

  const spade: Tool = {
    id: "spade",
    type: "Spade",
    image: "/Sprites/UI/Spade.png",
  };

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  const handleDragStart = (seed: SeedPacket) => (e: React.DragEvent) => {
    setDraggedSeed(seed);
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", seed.id);
  };

  const handleDragEnd = () => {
    setDraggedSeed(null);
  };

  const handleToolDragStart = (tool: Tool) => (e: React.DragEvent) => {
    setDraggedTool(tool);
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", tool.id);
  };

  const handleToolDragEnd = () => {
    setDraggedTool(null);
  };

  return (
    <main className="h-screen w-full bg-[#547E64] flex justify-center">
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
                  className={`size-16 flex justify-center items-center flex-col gap-0.5 cursor-grab active:cursor-grabbing transition-all hover:scale-110 ${
                    draggedSeed?.id === seed.id ? "opacity-50" : "opacity-100"
                  }`}
                >
                  <img
                    src={seed.image}
                    className="w-fit h-full image-pixelated object-contain pointer-events-none"
                    alt={`${seed.type} packet`}
                  />
                  <div className="text-xs pointer-events-none">${seed.price}</div>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex justify-center">
            <div className="text-5xl text-white font-bold">$100</div>
          </div>
        </div>
        <div className="p-8 flex flex-row justify-between items-center">
          <div className="relative w-fit h-fit">
            <img
              src="/Sprites/UI/SpadeUI.png"
              className="image-pixelated w-[100px] h-auto"
              alt="packet ui"
            />
            <div
              draggable
              onDragStart={handleToolDragStart(spade)}
              onDragEnd={handleToolDragEnd}
              className={`absolute inset-0 flex justify-center items-center cursor-grab active:cursor-grabbing transition-all hover:scale-110 ${
                draggedTool?.id === spade.id ? "opacity-50" : "opacity-100"
              }`}
            >
              <img
                src={spade.image}
                className="h-12 w-auto image-pixelated object-contain pointer-events-none"
                alt="Spade tool"
              />
            </div>
          </div>
          <div className="text-5xl text-white font-bold">5:00</div>
        </div>
      </div>
    </main>
  );
}

export default App;
