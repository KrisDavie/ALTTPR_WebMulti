import { Input } from "@/components/ui/input"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useAppSelector } from "@/app/hooks"
import {
  selectAvailableDevices,
  setConnectedDevice,
  setGrpcHost,
  setGrpcPort,
} from "./sniSlice"

import { useGetDevicesQuery, useLazyGetDevicesQuery } from "./sniApiSlice"

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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useAppDispatch } from "@/app/hooks"
import { on } from "events"

function SniSettings() {
  const dispatch = useAppDispatch()
  const devices: string[] = useAppSelector(selectAvailableDevices)
  const [triggerGetDevicesQuery, result, lastPromiseInfo] = useLazyGetDevicesQuery()
  
  const GPRCFormSchema = z.object({
    hostname: z.union([
      z.string().url({
        message: "Please enter a valid URL.",
      }),
      z.string().ip(),
    ]),
    port: z.coerce.number().int().min(1).max(65535),
  })

  const DeviceFormSchema = z.object({
    device: z
      .string()
      .refine(d => devices.includes(d)),
  })

  const gprcForm = useForm<z.infer<typeof GPRCFormSchema>>({
    resolver: zodResolver(GPRCFormSchema),
    defaultValues: {
      hostname: "127.0.0.1",
      port: 8190,
    },
  })

  const deviceForm = useForm<z.infer<typeof DeviceFormSchema>>({
    resolver: zodResolver(DeviceFormSchema),
    defaultValues: {
      device: "No devices...",
    },
  })

  function onSubmitGRPC(data: z.infer<typeof GPRCFormSchema>) {
    dispatch(setGrpcHost(data.hostname))
    dispatch(setGrpcPort(data.port))
  }

  function onSubmitDevice(data: z.infer<typeof DeviceFormSchema>) {
    dispatch(setConnectedDevice(data.device))
  }

  async function refreshDevices() {
    await triggerGetDevicesQuery({noConnect: true})
  }


  const handleConnect = (event: React.MouseEvent) => {
    // dispatch(connect())
  }

  const handleReset = (event: React.MouseEvent) => {
    // dispatch(reset())
  }

  useEffect(() => {
    if (devices.length > 0) {
      deviceForm.setValue("device", devices[0])
    }
  }, [devices])

  return (
    <div className="flex flex-col w-auto">
      <div className="flex flex-row">
        <Button className="mx-1" onClick={handleReset}>
          Reset Console
        </Button>
      </div>
      <div className="flex flex-col">
        <Form {...gprcForm}>
          <form
            onSubmit={gprcForm.handleSubmit(onSubmitGRPC)}
            className="w-auto space-x-1 py-5 flex flex-col items-left"
          >
            <FormField
              control={gprcForm.control}
              name="hostname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hostname/IP</FormLabel>
                  <FormControl>
                    <Input
                      className="w-64"
                      placeholder="127.0.0.1"
                      {...field}
                      defaultValue={field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={gprcForm.control}
              name="port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port</FormLabel>
                  <FormControl>
                    <Input
                      className="w-64"
                      placeholder="8080"
                      type="number"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <Button type="submit">Set GRPC settings</Button>

            </div>

          </form>
        </Form>
        </div>
      <div className="flex flex-col">
        <Form {...deviceForm}>
          <form
            onSubmit={deviceForm.handleSubmit(onSubmitDevice)}
            className="w-auto space-x-1 py-5 flex flex-col items-left"
          >
            <FormField
              control={deviceForm.control}
              name="device"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Device</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Select a device">
                          {deviceForm.watch("device")}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {devices.map(device => (
                        <SelectItem key={device} value={device}>
                          {device}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-row">
              <Button onClick={refreshDevices}>Refresh Devices</Button>
              <Button type="submit">Connect to device</Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}

export default SniSettings
