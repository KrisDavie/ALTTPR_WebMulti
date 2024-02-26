import { useAppDispatch } from "@/app/hooks"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useState } from "react"
import MultiServer from "./multiServer"
import MultiClientForm from "./connectForm"

function landingPage() {
  const dispatch = useAppDispatch()
  const [selectedMode, setSelectedMode] = useState("")

  return (
    <div className="flex flex-col justify-center items-center">
      <div className="flex space-y-1 flex-col justify-center items-center">
        <h1 className="text-xl font-medium leading-none">
          Muffins' Web-based Multiworld
        </h1>
        <p className="text-sm text-muted-foreground">
          A web based server/client for ALTTPR Door Rando multiworlds.
        </p>
      </div>
      <Separator className="my-4 " />
      {selectedMode === "" && (
        <div className="flex flex-row h-5 items-center justify-center space-x-4 text-sm">
          <Button onClick={() => setSelectedMode("server")}>
            Start a Server
          </Button>
          <Button onClick={() => setSelectedMode("client")} >Join a Server</Button>
        </div>
      )}
      {selectedMode === "server" && (
        <div className="flex flex-col items-center space-y-4 text-sm">
          <MultiServer setSelectedMode={setSelectedMode}/>
        </div>
      )}
      {selectedMode === "client" && (
        <div className="flex flex-col items-center space-y-4 text-sm">
          <MultiClientForm setSelectedMode={setSelectedMode}/>
        </div>
      )}

    </div>
  )
}

export default landingPage
