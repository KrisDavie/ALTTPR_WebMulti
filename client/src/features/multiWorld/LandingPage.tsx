import { useAppSelector } from "@/app/hooks"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useCallback, useEffect, useState } from "react"
import MultiServer from "./MultiServer"
import MultiClientForm from "./MultiForm"
import { TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tooltip } from "@radix-ui/react-tooltip"
import { useSearchParams } from "react-router-dom"

function LandingPage() {
  const [searchParams] = useSearchParams()
  const multidataUrl = searchParams.get("multidata")

  const [selectedMode, setSelectedMode] = useState("")
  const user = useAppSelector(state => state.user)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  // Counter to track dragenter/dragleave events to prevent flickering when dragging over child elements
  const [_dragCounter, setDragCounter] = useState(0)
  const [droppedFiles, setDroppedFiles] = useState<FileList | null>(null)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(c => c + 1)
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(c => {
      const next = c - 1
      if (next <= 0) setIsDragging(false)
      return Math.max(next, 0)
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    setDragCounter(0)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      setDroppedFiles(files)
      setSelectedMode("server")
    }
  }, [])

  // Auto-open server form when multidata URL param is present and user is logged in
  useEffect(() => {
    if (multidataUrl && user.discordUsername && selectedMode !== "server") {
      setSelectedMode("server")
    }
  }, [multidataUrl, user.discordUsername, selectedMode])

  function handleTooltipOpenChange(open: boolean) {
    if (!user.discordUsername) {
      setTooltipOpen(open)
    } else {
      setTooltipOpen(false)
    }
  }

  return (
    <div
      className="flex flex-1 w-full h-full justify-center items-center relative"
      onDragEnter={!multidataUrl ? handleDragEnter : undefined}
      onDragLeave={!multidataUrl ? handleDragLeave : undefined}
      onDragOver={!multidataUrl ? handleDragOver : undefined}
      onDrop={!multidataUrl ? handleDrop : undefined}
    >
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/10">
          <div className="bg-secondary p-4 rounded-md">
            <span className="text-lg font-medium text-primary">Drop multidata file here</span>
          </div>
        </div>
      )}
      <div className="flex flex-col justify-center items-center">
        <div className="flex space-y-1 flex-col justify-center items-center">
          <h1 className="text-xl font-medium leading-none">
            Muffins' Web-based Multiworld
          </h1>
          <p className="text-sm text-muted-foreground">
            A web based server/client for ALTTPR Door Rando multiworlds.
          </p>
        </div>
        <Separator className="my-4" />
        {selectedMode === "" && (
          <div className="flex flex-col items-center space-y-4">
            {multidataUrl && !user.discordUsername && (
              <p className="text-sm text-muted-foreground text-red-800">
                Log in with Discord to start a server with the provided multidata.
              </p>
            )}
            <div className="flex flex-row h-5 items-center justify-center space-x-4 text-sm">
              <TooltipProvider>
                <Tooltip delayDuration={150} onOpenChange={handleTooltipOpenChange} open={tooltipOpen && !user.discordUsername}>
                  <TooltipTrigger>
                    <Button onClick={() => setSelectedMode("server")} disabled={!user.discordUsername}>
                      Start a Server
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    You must be logged in via Discord to start a server.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <Button onClick={() => setSelectedMode("client")} >Join a Server</Button>
            </div>
          </div>
        )}
        {selectedMode === "server" && (
          <div className="flex flex-col items-center space-y-4 text-sm">
            <MultiServer setSelectedMode={setSelectedMode} multidataUrl={multidataUrl ?? undefined} droppedFiles={droppedFiles}/>
          </div>
        )}
        {selectedMode === "client" && (
          <div className="flex flex-col items-center space-y-4 text-sm">
            <MultiClientForm setSelectedMode={setSelectedMode}/>
          </div>
        )}
      </div>
    </div>
  )
}

export default LandingPage
