import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./globals.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main className="h-screen w-full bg-black flex justify-center">
      <div className="h-full w-full flex flex-col justify-between">
        <div className="flex flex-row justify-between h-fit w-full p-8">
          <ol className="bg-white p-2 h-fit w-fit flex flex-row gap-2">
            <li className="bg-neutral-200 p-2 size-18 items-center flex">
              <img src="https://placehold.co/400x400?text=Shovel+lol"></img>
            </li>
            <li className="bg-neutral-200 p-2 size-18 items-center flex">
              <img src="https://placehold.co/400x400?text=Pack+lol"></img>
            </li>
            <li className="bg-neutral-200 p-2 size-18 items-center flex">
              <img src="https://placehold.co/400x400?text=Pack2+lol"></img>
            </li>
          </ol>
          <div className="flex items-center justify-center">
            <div className="text-2xl text-white font-bold">$100</div>
          </div>
        </div>
        <div className="p-8 flex flex-row justify-between items-center">
          <div className="size-20 rounded-full bg-neutral-200"></div>
          <div className="text-2xl text-white font-bold">5:00</div>
        </div>
      </div>
    </main>
  );
}

export default App;
