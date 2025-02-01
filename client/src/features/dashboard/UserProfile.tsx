import { useAppSelector, useFetchUser } from "@/app/hooks"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { z } from "zod"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Checkbox } from "../../components/ui/checkbox"
import {
  useUpdateUserMutation,
} from "@/features/api/apiSlice"
import {  useEffect } from "react"

const formSchema = z.object({
  username: z
    .string()
    .min(2, {
      message: "Username must be at least 2 characters.",
    })
    .max(32, {
      message: "Username must be at most 32 characters.",
    })
    .optional()
    .or(z.literal("")),
  userNameAsDisplay: z.boolean(),
})

export default function UserProfile() {
  const user = useAppSelector(state => state.user)
  const defaultUsername =
    user.discordDisplayName === user.username ? "" : user.username

  const [updateUser] = useUpdateUserMutation()


  const { fetchUser } = useFetchUser()


  useEffect(() => {
    fetchUser(true)
  }, [updateUser, fetchUser])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: defaultUsername,
      userNameAsDisplay: user.usernameAsPlayerName,
    },
  })

  useEffect(() => {
    form.setValue("username", defaultUsername)
    form.setValue("userNameAsDisplay", user.usernameAsPlayerName === true)
  }, [defaultUsername, user, form])

  function onSubmit(values: z.infer<typeof formSchema>) {
    updateUser({
      username: values.username ?? "",
      usernameAsPlayerName: values.userNameAsDisplay
    })
  }
  return (
    <div className="flex flex-col w-full">
      <h1 className="text-2xl font-bold">User Profile</h1>
      <br />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-8 w-3/5"
        >
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    placeholder={user.discordDisplayName}
                    className="w-72"
                    {...field}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormDescription>
                    This is your public display name. Set to empty to use your
                    discord display name.
                  </FormDescription>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="userNameAsDisplay"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Username as display name in games</FormLabel>
                  <FormDescription>
                    Your username will replace the player name in the multiworld
                    event log.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
          <Button type="submit">Save</Button>
        </form>
      </Form>
    </div>
  )
}
