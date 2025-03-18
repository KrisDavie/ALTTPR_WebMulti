import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import * as z from "zod"
import { useUploadMultiDataMutation } from "../api/apiSlice"

import { useNavigate } from "react-router-dom"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleTrigger } from "@radix-ui/react-collapsible"
import { CollapsibleContent } from "@/components/ui/collapsible"
import { ChevronsUpDown } from "lucide-react"

interface MultiClientFormProps {
  setSelectedMode: (mode: string) => void
}

const allFlags = [
  { id: "chat", label: "Chat" },
  { id: "pauseRecieving", label: "Pause Receiving" },
  { id: "missingCmd", label: "/missing Command" },
  { id: "duping", label: "Item Duping" },
  { id: "forfeit", label: "Forfeit" },
]

function MultiServer(props: MultiClientFormProps) {
  const { setSelectedMode } = props
  const navigate = useNavigate()
  const [uploadMultiData] = useUploadMultiDataMutation()
  // Form with a file upload and a select for the game
  const FormSchema = z.object({
    file: z.any(),
    password: z.string().optional(),
    tournament: z.boolean(),
    flags: z.array(z.string()).refine(value => value.some(item => item)),
  })

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      password: "",
      tournament: false,
      flags: ["chat", "pauseRecieving", "missingCmd", "duping", "forfeit"],
    },
  })

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    const flags = allFlags.reduce((acc, flag) => {
      acc[flag.id] = data.flags.includes(flag.id)
      return acc
    }, {} as Record<string, boolean>)
    const res = await uploadMultiData({
      data: data.file[0],
      password: data.password,
      tournament: data.tournament,
      flags: flags,
    })

    navigate(`/multi/${res.data.mw_session}`)
  }

  function handleRaceSelect(checked: boolean) {
    const flagsToDisable = ["missingCmd", "forfeit"]
    if (checked) {
      const currentFlags = form.getValues("flags");
      const updatedFlags = currentFlags.filter(flag => !flagsToDisable.includes(flag));
      form.setValue("flags", updatedFlags)
    }
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
          <FormField
            control={form.control}
            name="tournament"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 mt-2">
                <FormLabel className="mt-2">Race?</FormLabel>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={() =>{ handleRaceSelect(!field.value); field.onChange(!field.value)}}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="flags"
            render={() => (
              <FormItem className="flex flex-col space-y-2 mt-2">
                <Collapsible>
                <div className="flex items-center space-x-2 my-1">
                  <FormLabel>Features</FormLabel>
                  <CollapsibleTrigger asChild>
                      <ChevronsUpDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <FormDescription className="mb-2">
                      Select the features you want enabled for this server.
                    </FormDescription>
                    {allFlags.map(flag => (
                      <FormField
                        key={flag.id}
                        control={form.control}
                        name="flags"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={flag.id}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(flag.id)}
                                  onCheckedChange={checked => {
                                    return checked
                                      ? field.onChange([...field.value, flag.id])
                                      : field.onChange(
                                          field.value?.filter(
                                            value => value !== flag.id,
                                          ),
                                        )
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">
                                {flag.label}
                              </FormLabel>
                            </FormItem>
                          )
                        }}
                      />
                    ))}
                    <FormMessage />
                  </CollapsibleContent>
                </Collapsible>
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
