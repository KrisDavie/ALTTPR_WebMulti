import { Button } from "@/components/ui/button"
import { useAppSelector, useAppDispatch } from "@/app/hooks"
import {
  MenubarContent,
  MenubarMenu,
  MenubarTrigger,
  Menubar,
  MenubarItem,
} from "@/components/ui/menubar"
import { useAuthUserMutation } from "../api/apiSlice"
import { setUser } from "./userSlice"
import { useEffect, useState } from "react"
import Cookies from "js-cookie"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function UserButton() {
  const user = useAppSelector(state => state.user)
  const dispatch = useAppDispatch()
  const [discordPopup, setDiscordPopup] = useState<Window | null>(null)
  const [userIdCookie, setUserIdCookie] = useState(Cookies.get("user_id"))
  const [userTypeCookie, setUserTypeCookie] = useState(Cookies.get("user_type"))
  const [modalOpen, setModalOpen] = useState(false)

  const username = user.username ?? "Guest#" + ("0000" + user.id).slice(-4)

  const [authUser, result] = useAuthUserMutation()

  async function fetchUser() {
    try {
      const payload = await authUser({}).unwrap()
      dispatch(setUser(payload))
    } catch (error) {
      console.error("rejected", error)
    }
  }

  async function createGuestUser() {
    Cookies.remove("user_id")
    Cookies.remove("session_token")
    Cookies.remove("user_type")
    fetchUser()
  }

  // Check for user details when the page loads
  useEffect(() => {
    console.log("checking for user details")
    if (
      userIdCookie === undefined ||
      (user.id !== 0 && user.id === parseInt(userIdCookie))
      // || discordPopup !== null
    ) {
      return
    }
    fetchUser()
  }, [userIdCookie, userTypeCookie])

  // Check the popup to see when the code has been stored
  useEffect(() => {
    if (!discordPopup) {
      return
    }

    const timer = setInterval(() => {
      if (!discordPopup || discordPopup.closed) {
        timer && clearInterval(timer)
        return
      }
      try {
        const popupUrl = discordPopup.location.href
      } catch (e) {
        return
      }
      
      const popupUrl = discordPopup.location.href
      const searchParams = new URL(popupUrl).searchParams
      const code = searchParams.get("code")
      if (code) {
        setUserIdCookie(discordPopup.document.head.dataset.userId)
        setUserTypeCookie("discord")
        discordPopup.close()
        setDiscordPopup(null)
        fetchUser()
        timer && clearInterval(timer)
      }
    }, 1000)
  }, [discordPopup])

  function openDiscordPopup() {
    const width = 500
    const height = 700
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2.5
    const title = `Discord OAuth Login`
    const url = `/api/v1/users/discord_login`
    const popup = window.open(
      url,
      title,
      `width=${width},height=${height},left=${left},top=${top}`,
    )
    setDiscordPopup(popup)
  }

  function logout(force = false) {
    if (Cookies.get("user_type") === "guest" && !force) {
      setModalOpen(true)
    } else {
      setModalOpen(false)
      Cookies.remove("user_id")
      Cookies.remove("session_token")
      Cookies.remove("user_type")
      dispatch(setUser({ id: 0 }))
    }
  }

  const profileItem = <MenubarItem>Profile</MenubarItem>
  const createAccountItem = (
    <MenubarItem onClick={createGuestUser}>Create Guest Account</MenubarItem>
  )
  const discordItem = (
    <MenubarItem
      onClick={openDiscordPopup}
      disabled={
        user.discordUsername !== null && user.discordUsername !== undefined
      }
    >
      {user.id !== 0
        ? user.discordUsername
          ? `Connected to ${user.discordUsername}`
          : "Connect to Discord"
        : "Log in with Discord"}
      <svg
        className="h-6 w-6 mr-2 pl-1"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        width="800px"
        height="800px"
        viewBox="0 -28.5 256 256"
        version="1.1"
        preserveAspectRatio="xMidYMid"
      >
        <g>
          <path
            d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"
            fill="#5865F2"
            fillRule="nonzero"
          ></path>
        </g>
      </svg>
    </MenubarItem>
  )

  const logoutItem = (
    <MenubarItem onClick={() => logout(false)}>Log out</MenubarItem>
  )

  return (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            You are currently logged in as a guest. If you log out, you will
            never be able to recover this account. Your history of joined
            multiworlds will be lost. If you log in via Discord before logging
            out, you will be able to log back in and history will be retained.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-row gap-x-2">
          <Button onClick={() => logout(true)} variant="destructive">
            Log out
          </Button>
          <Button onClick={() => setModalOpen(false)}>Cancel</Button>
        </div>
      </DialogContent>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>
            <div className="flex">
              {user.id !== 0 ? `Hello, ${username}!` : "Log in..."}
            </div>
          </MenubarTrigger>
          <MenubarContent>
            {user.id !== 0 ? profileItem : createAccountItem}
            {discordItem}
            {user.id !== 0 ? logoutItem : null}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </Dialog>
  )
}

export default UserButton
