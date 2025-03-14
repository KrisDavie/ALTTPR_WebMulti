import { useGetPlayersQuery, useSendNewItemsMutation } from "../api/apiSlice"
import _items from "../sni/items.json"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"
import * as z from "zod"

import { cn } from "@/lib/utils"

import { CaretSortIcon } from "@radix-ui/react-icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useState } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Separator } from "@/components/ui/separator"

interface IItems {
  [index: string]: number | number[]
}

const items: IItems = _items

interface ItemSenderProps {
  sessionId: string
}

function ItemSender(props: ItemSenderProps) {
  const { sessionId } = props
  const [sendItems] = useSendNewItemsMutation()
  const { isLoading, data: players } = useGetPlayersQuery(sessionId)
  const originalPlayerNames = players
    ? players.map((pnames: string[]) => pnames[1])
    : []

  const [itemPopoverOpen, setItemPopoverOpen] = useState(false)

  const FormSchema = z.object({
    item: z.string().refine(d => Object.keys(items).includes(d)),
    players: z.array(z.string()),
    password: z.string().optional(),
  })

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      item: "Bow",
      players: [],
      password: "",
    },
  })

  function onSubmit(data: z.infer<typeof FormSchema>) {
    const playerIdxs = data.players.map(
      player => originalPlayerNames.findIndex((p: string) => p === player) + 1,
    )
    sendItems({
      sessionId,
      itemId: items[data.item] as number,
      players: playerIdxs,
      password: data.password,
    })
  }

  return (
    <div className="flex flex-row align-bottom mt-4">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-row w-auto space-x-1"
        >
          <FormField
            control={form.control}
            name="item"
            render={({ field }) => (
              <FormItem className="flex flex-col justify-end items-center">
                <FormLabel className="flex flex-col">Item</FormLabel>
                <Popover
                  open={itemPopoverOpen}
                  onOpenChange={setItemPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-[200px]",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        {field.value
                          ? Object.keys(items).find(
                              item => item === field.value,
                            )
                          : "Select item"}
                        <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search Items..."
                        className="h-9"
                      />
                      <CommandList>
                        <CommandEmpty>No item found.</CommandEmpty>
                        <CommandGroup>
                          {Object.keys(items).map(item => (
                            <CommandItem
                              value={item}
                              key={item}
                              onSelect={() => {
                                form.setValue("item", item)
                                setItemPopoverOpen(false)
                              }}
                            >
                              {item}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </FormItem>
            )}
          />
          <Separator orientation="vertical" />
          <FormField
            control={form.control}
            name="players"
            render={({ field }) => (
              <FormItem className="flex flex-col items-center justify-end">
                <FormLabel className="flex flex-col">Player(s)</FormLabel>
                <FormControl>
                  <ToggleGroup
                    type="multiple"
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    {!isLoading &&
                      players &&
                      players.map((player: string[], ix: number) => (
                        <ToggleGroupItem
                          variant="outline"
                          key={ix}
                          value={player[1]}
                        >
                          {player[0] === player[1]
                            ? player[0]
                            : `${player[0]} (${player[1]})`}
                        </ToggleGroupItem>
                      ))}
                  </ToggleGroup>
                </FormControl>
              </FormItem>
            )}
          />
          <Separator orientation="vertical" />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="flex flex-col items-center justify-end">
                <FormLabel className="flex flex-col">Password</FormLabel>
                <FormControl>
                  <Input
                    className="w-[200px]"
                    {...field}
                    placeholder="Optional..."
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <div className="flex flex-row h-auto items-end">
            <Button className="flex flex-row" type="submit">
              Send
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

export default ItemSender
