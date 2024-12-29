import { useAppSelector } from "@/app/hooks"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useState } from "react"
import MultiServer from "./multiServer"
import MultiClientForm from "./connectForm"
import { TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tooltip } from "@radix-ui/react-tooltip"

function LandingPage() {
  const [selectedMode, setSelectedMode] = useState("")
  const user = useAppSelector(state => state.user)
  const [tooltipOpen, setTooltipOpen] = useState(false)

  function handleTooltipOpenChange(open: boolean) {
    if (user.id === 0) {
      setTooltipOpen(open)
    } else {
      setTooltipOpen(false)
    }
  }

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
          <TooltipProvider>
            <Tooltip delayDuration={150} onOpenChange={handleTooltipOpenChange} open={tooltipOpen && user.id === 0}>
              <TooltipTrigger>
                <Button onClick={() => setSelectedMode("server")} disabled={user.id === 0}>
                  Start a Server
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                You must be logged in to start a server.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
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

export default LandingPage
