'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Search, ArrowRight, Settings, Receipt, FileText, Wallet, Tag } from 'lucide-react'
import { useSpotlight } from './SpotlightProvider'
import { SpotlightResultGroup } from './SpotlightResultGroup'
import { useSpotlightSearch } from '@/lib/spotlight/useSpotlightSearch'
import type { SpotlightHit } from '@/lib/spotlight/search'
import { TABS } from '@/components/nav/tabs'
import { cn } from '@/lib/cn'

const ADMIN_JUMP = { key: 'admin', href: '/admin', label: 'Admin' } as const

export function SpotlightDialog() {
  const { open, setOpen, closeSpotlight } = useSpotlight()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const { groups } = useSpotlightSearch(search)

  // Reset search input whenever the dialog closes.
  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  function jumpTo(href: string) {
    closeSpotlight()
    router.push(href)
  }

  function onHitSelect(hit: SpotlightHit) {
    closeSpotlight()
    router.push(hit.href)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0'
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-[20%] z-50 w-[92vw] max-w-xl -translate-x-1/2',
            'rounded-xl border border-rule bg-bg shadow-2xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95'
          )}
        >
          <Dialog.Title className="sr-only">Spotlight</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search the app or jump to a surface.
          </Dialog.Description>

          <Command label="Spotlight" shouldFilter={false} className="overflow-hidden rounded-xl">
            <div className="flex items-center gap-2 border-b border-rule px-3 py-2.5">
              <Search size={14} className="shrink-0 text-muted" aria-hidden="true" />
              <Command.Input
                autoFocus
                value={search}
                onValueChange={setSearch}
                placeholder="Search or jump to a surface…"
                className={cn(
                  'flex-1 bg-transparent text-sm text-ink',
                  'placeholder:italic placeholder:text-muted',
                  'focus:outline-none'
                )}
              />
              <kbd className="hidden sm:inline-block shrink-0 rounded border border-rule bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted tabular">
                ESC
              </kbd>
            </div>

            <Command.List className="max-h-[60vh] overflow-y-auto py-2">
              <Command.Empty className="px-4 py-6 text-center text-sm italic text-muted">
                No matches.
              </Command.Empty>

              <Command.Group
                heading="Jump"
                className={cn(
                  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5',
                  '[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase',
                  '[&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:italic',
                  '[&_[cmdk-group-heading]]:text-muted'
                )}
              >
                {TABS.map(tab => {
                  const Icon = tab.icon
                  return (
                    <Command.Item
                      key={tab.key}
                      value={`jump ${tab.label}`}
                      onSelect={() => jumpTo(tab.href)}
                      className={cn(
                        'group flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-ink mx-2',
                        'aria-selected:bg-surface'
                      )}
                    >
                      <Icon size={14} className="shrink-0 text-muted group-aria-selected:text-ink" aria-hidden="true" />
                      <span>{tab.label}</span>
                      <ArrowRight
                        size={12}
                        className="ml-auto text-muted opacity-0 group-aria-selected:opacity-100"
                        aria-hidden="true"
                      />
                    </Command.Item>
                  )
                })}
                <Command.Item
                  key={ADMIN_JUMP.key}
                  value={`jump ${ADMIN_JUMP.label}`}
                  onSelect={() => jumpTo(ADMIN_JUMP.href)}
                  className={cn(
                    'group flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-ink mx-2',
                    'aria-selected:bg-surface'
                  )}
                >
                  <Settings size={14} className="shrink-0 text-muted group-aria-selected:text-ink" aria-hidden="true" />
                  <span>{ADMIN_JUMP.label}</span>
                  <ArrowRight
                    size={12}
                    className="ml-auto text-muted opacity-0 group-aria-selected:opacity-100"
                    aria-hidden="true"
                  />
                </Command.Item>
              </Command.Group>

              <SpotlightResultGroup
                heading="Transactions"
                hits={groups.transactions}
                Icon={Receipt}
                onSelect={onHitSelect}
              />
              <SpotlightResultGroup
                heading="Bills"
                hits={groups.bills}
                Icon={FileText}
                onSelect={onHitSelect}
              />
              <SpotlightResultGroup
                heading="Accounts"
                hits={groups.accounts}
                Icon={Wallet}
                onSelect={onHitSelect}
              />
              <SpotlightResultGroup
                heading="Categories"
                hits={groups.categories}
                Icon={Tag}
                onSelect={onHitSelect}
              />
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
