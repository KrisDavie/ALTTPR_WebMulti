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
import { useUploadMultiDataMutation } from "../api/apiSlice"

import { useNavigate } from "react-router-dom"

function MultiServer(props: any) {
  const { setSelectedMode } = props
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [uploadMultiData, result] = useUploadMultiDataMutation()
  // Form with a file upload and a select for the game
  const FormSchema = z.object({
    file: z.any(),
    game: z.string().min(1),
    password: z.string().optional(),
  })

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      game: "z3",
      password: "",
    },
  })

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    const res: any = await uploadMultiData({
      data: data.file[0],
      game: data.game,
      password: data.password,
    })

    navigate(`/multiAdmin/${res.data.mw_session}`)

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
            name="file"
            render={({ field: { onChange }, ...field }) => (
              <FormItem>
                <FormLabel htmlFor="file">Multiworld Data</FormLabel>
                <FormControl>
                  <Input
                    className="w-80"
                    type="file"
                    {...field}
                    onChange={event => onChange(event.target.files)}
                  />
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
            Start Server
          </Button>
        </form>
      </Form>
    </div>
  )
}

export default MultiServer
