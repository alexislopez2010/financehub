import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Fetches the distinct (category, sub_category) pairs from category_rules
 * and returns them as a tree: { category: [sub_category, ...] }.
 *
 * Always includes a "Uncategorized" option as a sentinel.
 */
export function useCategoryTaxonomy() {
  const [tree, setTree] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setError('')
      try {
        const { data, error } = await supabase
          .from('category_rules')
          .select('category, sub_category')
          .eq('is_active', true)
        if (error) throw error
        const t = {}
        for (const row of data || []) {
          const cat = row.category
          if (!cat) continue
          if (!t[cat]) t[cat] = new Set()
          if (row.sub_category) t[cat].add(row.sub_category)
        }
        // Convert Sets to sorted arrays + ensure Uncategorized exists
        const out = {}
        for (const cat of Object.keys(t).sort()) {
          out[cat] = Array.from(t[cat]).sort()
        }
        if (!out['Uncategorized']) out['Uncategorized'] = []
        if (alive) setTree(out)
      } catch (e) {
        if (alive) setError(e.message || 'Failed to load categories')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  return { tree, categories: Object.keys(tree), loading, error }
}
