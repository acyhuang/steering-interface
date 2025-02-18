import { Chat } from "@/components/Chat"
import { ConnectionStatus } from "@/components/ConnectionStatus"

function App() {
  return (
    <div className="p-4">
      <ConnectionStatus />
      <h1 className="text-2xl font-bold mb-4">Steering Interface</h1>
      <Chat />
    </div>
  )
}

export default App 