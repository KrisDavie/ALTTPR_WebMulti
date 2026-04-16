import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal } from "lucide-react"
import { skipToken } from "@reduxjs/toolkit/query/react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

export interface IPaginatedSessions {
  items: ISession[]
  total: number
  page: number
  pageSize: number
}

export const columns: ColumnDef<ISession>[] = [
  {
    accessorKey: "id",
    header: "ID",
    enableSorting: false,
  },
  {
    accessorKey: "players",
    header: () => (
      <div className="flex items-center justify-center">Players</div>
    ),
    enableSorting: false,
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
    enableSorting: false,
  },
  {
    id: "progress",
    header: () => (
      <div className="flex items-center justify-center">Progress</div>
    ),
    enableSorting: false,
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
    enableSorting: false,
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
    header: ({ column }) => {
      return (
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Created
            {column.getIsSorted() === "asc" ? <ArrowUp className="ml-1 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ArrowDown className="ml-1 h-4 w-4" /> : <ArrowUpDown className="ml-1 h-4 w-4" />}
          </Button>
        </div>
      )
    },
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
    header: ({ column }) => {
      return (
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Last Change
            {column.getIsSorted() === "asc" ? <ArrowUp className="ml-1 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ArrowDown className="ml-1 h-4 w-4" /> : <ArrowUpDown className="ml-1 h-4 w-4" />}
          </Button>
        </div>
      )
    },
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
    header: ({ column }) => {
      return (
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Race?
            {column.getIsSorted() === "asc" ? <ArrowUp className="ml-1 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ArrowDown className="ml-1 h-4 w-4" /> : <ArrowUpDown className="ml-1 h-4 w-4" />}
          </Button>
        </div>
      )
    },
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
  pageCount: number
  page: number
  onPageChange: (page: number) => void
  sorting: SortingState
  onSortingChange: (sorting: SortingState) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
  page,
  onPageChange,
  sorting,
  onSortingChange,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    onSortingChange: updater => {
      const next = typeof updater === "function" ? updater(sorting) : updater
      onSortingChange(next)
      onPageChange(1)
    },
    state: {
      sorting,
    },
    manualPagination: true,
    pageCount,
  })

  return (
    <div className="flex flex-col w-full">
      <div className="flex rounded-md border w-full">
        <Table className="table-fixed">
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
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <div className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground">Page</span>
          <Input
            type="number"
            min={1}
            max={pageCount}
            value={page}
            onChange={e => {
              const val = Number(e.target.value)
              if (val >= 1 && val <= pageCount) onPageChange(val)
            }}
            className="h-8 w-16 text-center"
          />
          <span className="text-muted-foreground">of {pageCount}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

const PAGE_SIZE = 10

export const MultiworldSessions = () => {
  const user = useAppSelector(state => state.user)
  const [page, setPage] = useState(1)
  const [sorting, setSorting] = useState<SortingState>([])
  const sortBy = sorting.length > 0 ? sorting[0].id : undefined
  const sortDir = sorting.length > 0 ? (sorting[0].desc ? "desc" : "asc") : undefined
  const { data, isLoading, isFetching } = useGetAllSessionsQuery(
    user.id !== 0 ? { userId: user.id, page, pageSize: PAGE_SIZE, sortBy, sortDir } : skipToken,
  )
  if (isLoading) {
    return (
      <div className="flex flex-row items-center space-x-2 pt-5">
        <LoadingSpinner />
        <span>Loading data...</span>
      </div>
    )
  }
  const pageCount = data ? Math.ceil(data.total / PAGE_SIZE) : 1
  return (
    <div className={isFetching ? "opacity-60 pointer-events-none" : ""}>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        pageCount={pageCount}
        page={page}
        onPageChange={setPage}
        sorting={sorting}
        onSortingChange={setSorting}
      />
    </div>
  )
}
