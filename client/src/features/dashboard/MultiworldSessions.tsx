import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { MoreHorizontal } from "lucide-react"
import { skipToken } from "@reduxjs/toolkit/query/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { CheckIcon, XIcon } from "lucide-react"
import { useGetAllSessionsQuery } from "@/features/api/apiSlice"
import { useAppSelector } from "@/app/hooks"
import { LoadingSpinner } from "../../components/ui/spinner"

export interface IPlayerInfo {
  playerNumber: number
  playerName: string
  collectionRate: number
  totalLocations: number
  goalCompleted: boolean
  curCoords: [number, number]
  world: "EG1" | "EG2" | "LW" | "DW" | "HC" | "EP" | "DP" | "AT" | "SP" | "PD" | "MM" | "SW" | "IP" | "TH" | "TT" | "TR" | "GT"
  health: number
  maxHealth: number
  userId?: number
  usernameAsPlayerName?: boolean
  userName?: string
  colour?: string
}

export interface IFeatures {
  chat: boolean
  pauseRecieving: boolean
  missingCmd: boolean
  duping: boolean
  forfeit: boolean
}

export interface ISession {
  id: string
  players: IPlayerInfo[]
  status: "active" | "idle" | "completed" // idle if no events in last 1 hour
  owner: [string, number] // userId
  admins?: [string, number][] // userIds
  createdTimestamp: number
  lastChangeTimestamp: number
  featureFlags: IFeatures
  race: boolean
}

export const columns: ColumnDef<ISession>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "players",
    header: () => (
      <div className="flex items-center justify-center">Players</div>
    ),
    cell: ({ row }) => {
      const playerNames = row.original.players
        .map(player => player.playerName)
        .join(", ")
      return (
        <div className="flex items-center justify-center text-center">
          {playerNames}
        </div>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
  },
  {
    id: "progress",
    header: () => (
      <div className="flex items-center justify-center">Progress</div>
    ),
    cell: ({ row }) => {
      const players = row.original.players
      const totcr = players.reduce(
        (acc, player) => acc + player.totalLocations,
        0,
      )
      const actualcr = players.reduce(
        (acc, player) => acc + player.collectionRate,
        0,
      )
      return (
        <div className="flex items-center justify-center">
          {actualcr}/{totcr}
        </div>
      )
    },
  },
  {
    id: "completed",
    header: () => (
      <div className="flex items-center justify-center">Completed</div>
    ),
    cell: ({ row }) => {
      const players = row.original.players
      const completed = players.filter(player => player.goalCompleted).length
      const total = players.length
      return (
        <div className="flex items-center justify-center">
          {completed}/{total}
        </div>
      )
    },
  },
  {
    accessorKey: "owner",
    header: () => <div className="flex items-center justify-center">Owner</div>,
    cell: ({ row }) => {
      const owner = row.original.owner
      return <div className="flex items-center justify-center">{owner[0]}</div>
    },
  },
  {
    accessorKey: "admins",
    header: () => (
      <div className="flex items-center justify-center">Admins</div>
    ),
    cell: ({ row }) => {
      const admins = row.original.admins
      const adminNames = admins?.map(admin => admin[0])
      return (
        <div className="flex items-center justify-center text-center">
          {adminNames ? adminNames.join(", ") : ""}
        </div>
      )
    },
  },
  {
    accessorKey: "createdTimestamp",
    header: () => (
      <div className="flex items-center justify-center">Created</div>
    ),
    cell: ({ row }) => {
      return (
        <div className="flex items-center justify-center text-center">
          {new Date(row.original.createdTimestamp).toLocaleString()}
        </div>
      )
    },
  },
  {
    accessorKey: "lastChangeTimestamp",
    header: () => (
      <div className="flex items-center justify-center">Last Change</div>
    ),
    cell: ({ row }) => {
      return (
        <div className="flex items-center justify-center text-center">
          {new Date(row.original.lastChangeTimestamp).toLocaleString()}
        </div>
      )
    },
  },
  {
    accessorKey: "race",
    header: () => <div className="flex items-center justify-center">Race?</div>,
    cell: ({ row }) => {
      return (
        <div className="flex items-center justify-center">
          {row.original.race ? (
            <CheckIcon size={16} color="green" />
          ) : (
            <XIcon size={16} color="red" />
          )}
        </div>
      )
    },
  },
  {
    id: "actions",
    cell: function ActionCellComponent({ row }) {
      const session = row.original
      const user = useAppSelector(state => state.user)
      const admins = session.admins?.map(([_, id]) => id)
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(session.id)}
            >
              Copy Session ID
            </DropdownMenuItem>
            {/* {
              <DropdownMenuItem
                disabled={!(admins?.includes(user.id) || user.superUser)}
              >
                Add/Remove Admin
              </DropdownMenuItem>
            } */}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="flex flex-col w-full">
      <div className="flex rounded-md border w-full">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="h-[73px]">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

export const MultiworldSessions = () => {
  const user = useAppSelector(state => state.user)
  const { data: sessions, isLoading } = useGetAllSessionsQuery(
    user.id !== 0 ? user.id : skipToken,
  )
  if (isLoading) {
    return (
      <div className="flex flex-row items-center space-x-2 pt-5">
        <LoadingSpinner />
        <span>Loading data...</span>
      </div>
    )
  }
  return <DataTable columns={columns} data={sessions ?? []} />
}
