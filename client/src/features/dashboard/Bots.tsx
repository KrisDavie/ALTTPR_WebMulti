import { useAppSelector, useFetchUser } from "@/app/hooks"
import {
  useCreateApiKeyMutation,
  useCreateBotMutation,
  useDeleteBotMutation,
  useRevokeApiKeyMutation,
} from "@/features/api/apiSlice"
import { Button } from "../../components/ui/button"
import { Separator } from "../../components/ui/separator"
import { useEffect, useState } from "react"
import { Input } from "../../components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog"

function Bots() {
  const user = useAppSelector(state => state.user)
  const [
    createBot,
    { isLoading: isCreatingBot, data: newBotData, error: botError },
  ] = useCreateBotMutation()
  const [createAPIKey, { isLoading: isCreatingAPIKey, data: newApiKeyData }] =
    useCreateApiKeyMutation()

  const [deleteBot, { data: deletedBotData }] = useDeleteBotMutation()
  const [revokeAPIKey, { data: revokedAPIKeysData }] = useRevokeApiKeyMutation()

  const [botUsername, setBotUsername] = useState("")

  const [open, setOpen] = useState<boolean>(false)
  const [selected, setSelected] = useState<"" | "bot" | "api_key">("")
  const [alertFunction, setAlertFunction] = useState<(() => void) | null>(null)

  const { fetchUser } = useFetchUser()

  const handleCreateBot = async (botName: string) => {
    try {
      await createBot(botName).unwrap()
      setBotUsername("")
    } catch (error) {
      console.error("rejected", error)
    }
  }

  useEffect(() => {
    fetchUser(true)
  }, [newBotData, newApiKeyData, deletedBotData, revokedAPIKeysData, fetchUser])

  const alertDatas = {
    "": {
      title: "Are you absolutely sure?",
      description: "",
    },
    bot: {
      title: "Remove this bot?",
      description:
        "This bot will be removed from your account and all associated API keys will be revoked. \
        The bot will remain inactive in the database to preserve any sessions started by it, but \
        you will lose administration access to those sessions. This action cannot be undone.",
    },
    api_key: {
      title: "Are you absolutely sure?",
      description:
        "This will revoke this API key and it will no longer be usable. This action cannot be undone.",
    },
  }

  return (
    <div className="flex flex-col w-full overflow-y-auto">
      <h1 className="text-2xl font-bold">Bots</h1>
      <div className="flex flex-col mt-4 w-96 text-muted-foreground">
        <p>
          You can create up to 3 bots. Bots are exclusively used to automate the
          opening and administration of sessions.
        </p>
      </div>
      <br />
      {user.bots?.length !== 0 ? (
        user.bots.map(bot => (
          <div
            key={bot.id}
            className="flex flex-col mb-4 w-[36em] border rounded-md p-4"
          >
            <p>
              {bot.username} - ID: {bot.id}
            </p>
            <h2 className="text-sm font-bold underline mt-2">API Keys</h2>
            {bot.api_keys?.map((apiKey, ix) => (
              <div
                key={`${bot.id}_apikey${ix}`}
                className="flex flex-col justify-between"
              >
                <div className="flex flex-col">
                  <span>{apiKey.description}</span>
                  {newApiKeyData && newApiKeyData.user_id === bot.id && newApiKeyData.id === apiKey.id && (
                    <div className="my-3">
                      <span className="text-muted-foreground text-red-500 font-bold">
                        API Key Created - This will not be shown again!
                      </span>
                      <br />
                      <span className="text-green-500 font-bold">
                        {newApiKeyData.key}
                      </span>
  
                    </div>
                  )}
                  <span className="text-muted-foreground">
                    Created: {apiKey.created_at}
                  </span>
                  <span className="text-muted-foreground">
                    Last Used: {apiKey.last_used}
                  </span>
                </div>
                <Button
                  className="w-16 p-4 mt-2"
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    // revokeAPIKey({ botId: bot.id, apiKeyId: apiKey.id })
                    {
                      setSelected("api_key")
                      setOpen(true)
                      setAlertFunction(
                        () => () =>
                          revokeAPIKey({ botId: bot.id, apiKeyId: apiKey.id }),
                      )
                    }
                  }
                >
                  Revoke
                </Button>
                {bot.api_keys && ix !== bot.api_keys.length - 1 && (
                  <Separator className="m-3" />
                )}
              </div>
            ))}

            <br />
            <div className="flex flex-row justify-between">
              <Button
                onClick={() => createAPIKey(bot.id)}
                disabled={isCreatingAPIKey}
                className="w-32"
                size="sm"
              >
                Add New API Key
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setSelected("bot")
                  setOpen(true)
                  setAlertFunction(() => () => deleteBot(bot.id))
                }}
              >
                Remove {bot.username}
              </Button>
            </div>
          </div>
        ))
      ) : (
        <div>
          <p>You don't have any bots yet.</p>
        </div>
      )}
      <br />
      {botError && "status" in botError && botError.status === 409 && (
        <p className="text-red-500 font-bold text-lg m-1">
          ERROR: Username already in use!
        </p>
      )}
      <div className="flex flex-col w-96">
        <Input
          placeholder="Bot Username"
          value={botUsername}
          onChange={e => setBotUsername(e.target.value)}
          className="w-48 m-1"
          disabled={isCreatingBot || user.bots.length >= 3}
        />
        <Button
          onClick={() => handleCreateBot(botUsername)}
          disabled={isCreatingBot || user.bots.length >= 3 || !botUsername}
          className="w-48 m-1"
        >
          Create A Bot
        </Button>
      </div>
      <AlertDialog
        open={open}
        onOpenChange={isOpen => {
          if (isOpen === true) return
          setSelected("")
          setOpen(false)
          setAlertFunction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDatas[selected].title}</AlertDialogTitle>
            <AlertDialogDescription>
              {alertDatas[selected].description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="variant:destructive"
              onClick={() => alertFunction && alertFunction()}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Bots
