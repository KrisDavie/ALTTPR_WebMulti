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
import { useUploadMultiDataMutation, useUploadMultiDataFromUrlMutation } from "../api/apiSlice"

import { useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleTrigger } from "@radix-ui/react-collapsible"
import { CollapsibleContent } from "@/components/ui/collapsible"
import { ChevronsUpDown, Link } from "lucide-react"

interface MultiServerProps {
  setSelectedMode: (mode: string) => void
  multidataUrl?: string
  droppedFiles?: FileList | null
}

const allFlags = [
  { id: "chat", label: "Chat" },
  { id: "pauseRecieving", label: "Pause Receiving" },
  { id: "missingCmd", label: "/missing Command" },
  { id: "duping", label: "Item Duping" },
  { id: "forfeit", label: "Forfeit" },
]

function MultiServer(props: MultiServerProps) {
  const { setSelectedMode, multidataUrl, droppedFiles } = props
  const navigate = useNavigate()
  const [uploadMultiData] = useUploadMultiDataMutation()
  const [uploadMultiDataFromUrl] = useUploadMultiDataFromUrlMutation()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const FormSchema = z.object({
    file: z.any().optional(),
    password: z.string().optional(),
    tournament: z.boolean(),
    flags: z.array(z.string()).refine(value => value.some(item => item)),
  }).superRefine((data, ctx) => {
    if (!multidataUrl && (!data.file || data.file.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A multidata file is required",
        path: ["file"],
      })
    }
  })

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      password: "",
      tournament: false,
      flags: ["chat", "pauseRecieving", "missingCmd", "duping", "forfeit"],
    },
  })

  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      form.setValue("file", droppedFiles, { shouldValidate: true })
    }
  }, [droppedFiles, form])

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setSubmitError(null)
    const flags = allFlags.reduce((acc, flag) => {
      acc[flag.id] = data.flags.includes(flag.id)
      return acc
    }, {} as Record<string, boolean>)

    let res
    if (multidataUrl) {
      res = await uploadMultiDataFromUrl({
        url: multidataUrl,
        password: data.password,
        tournament: data.tournament,
        flags: flags,
      })
    } else {
      res = await uploadMultiData({
        data: data.file[0],
        password: data.password,
        tournament: data.tournament,
        flags: flags,
      })
    }

    if ("error" in res) {
      const err = res.error as { data?: { detail?: string } }
      setSubmitError(err.data?.detail ?? "Failed to create session")
      return
    }

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
          {multidataUrl ? (
            <FormItem>
              <FormLabel>Multiworld Data</FormLabel>
              <div className="flex items-center gap-2 text-sm text-muted-foreground w-80 p-2 rounded-md border bg-muted">
                <Link className="h-4 w-4 shrink-0" />
                <span className="truncate" title={multidataUrl}>{multidataUrl}</span>
              </div>
            </FormItem>
          ) : (
            <FormField
              control={form.control}
              name="file"
              render={({ field: { onChange, value }, ...field }) => (
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
                  {value?.[0] && value instanceof FileList && (
                    <p className="text-sm text-muted-foreground">Selected: {value[0].name}</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
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
          {submitError && (
            <p className="text-sm text-destructive mb-2">{submitError}</p>
          )}
          <Button type="submit" className="w-80">
            Start Server
          </Button>
        </form>
      </Form>
    </div>
  )
}

export default MultiServer
