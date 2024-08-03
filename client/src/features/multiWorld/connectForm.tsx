import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import * as z from "zod"

import { useAppDispatch } from "@/app/hooks"
import { useNavigate } from "react-router-dom"
import { log } from "../loggerSlice"

function MultiClientForm(props: any) {
  const { setSelectedMode } = props
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const FormSchema = z.object({
    sessionId: z.string().min(36),
    game: z.string().min(1),
    password: z.string().optional(),
  })

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      sessionId: "",
      game: "z3",
      password: "",
    },
  })

  function onSubmit(data: z.infer<typeof FormSchema>) {
    dispatch(log(`Connecting to multiworld session ${data.sessionId}`))
    navigate(`/multi/${data.sessionId}`)
  }

  return (
    <div>
      <Button onClick={() => setSelectedMode("")}>Back</Button>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-auto space-x-1 py-3 flex flex-col items-left"
        >
          <FormField
            control={form.control}
            name="sessionId"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="file">Multiworld Session ID</FormLabel>
                <FormControl>
                  <Input className="w-80" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <br />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password (optional)</FormLabel>
                <FormControl>
                  <Input className="w-80" {...field} placeholder="password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <br />
          <FormField
            control={form.control}
            name="game"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Game</FormLabel>
                <FormControl>
                  <Input disabled className="w-80" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <br />
          <Button type="submit" className="w-80">
            Join Game
          </Button>
        </form>
      </Form>
    </div>
  )
}

export default MultiClientForm
