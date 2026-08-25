import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useDocStore } from '@/store/documentStore'
import { usePdfDoc } from '@/lib/usePdfDoc'
import { searchDocument, type SearchHit } from '@/lib/search'
import PageView from '@/components/PageView'

/** ระยะขอบซ้าย-ขวารวมในพื้นที่แสดงผล (px) ใช้คำนวณ fit width */
const H_PADDING = 48

export default function Viewer(): JSX.Element {
  const doc = usePdfDoc()
  const pageOrder = useDocStore((s) => s.pageOrder)
  const pages = useDocStore((s) => s.pages)
  const zoom = useDocStore((s) => s.zoom)
  const fitMode = useDocStore((s) => s.fitMode)
  const setZoom = useDocStore((s) => s.setZoom)
  const currentPage = useDocStore((s) => s.currentPage)
  const setCurrentPage = useDocStore((s) => s.setCurrentPage)

  const scrollRef = useRef<HTMLDivElement>(null)
  const pageEls = useRef<(HTMLDivElement | null)[]>([])
  const programmaticScroll = useRef(false)
  // ค่าหน้าที่ "ยอมรับแล้ว" ว่าตรงกับ scroll — กัน effect เด้ง scroll ซ้ำ
  const lastReq = useRef(currentPage)

  // ----- คำนวณ fit width / fit page -----
  const recomputeFit = useCallback(() => {
    if (fitMode === 'custom' || !scrollRef.current) return
    const originalIndex = pageOrder[currentPage] ?? 0
    const info = pages[originalIndex]
    if (!info) return
    const rot = info.rotation === 90 || info.rotation === 270
    const pw = rot ? info.height : info.width
    const ph = rot ? info.width : info.height
    const availW = scrollRef.current.clientWidth - H_PADDING
    const availH = scrollRef.current.clientHeight - 48
    const z = fitMode === 'width' ? availW / pw : Math.min(availW / pw, availH / ph)
    // guard: อย่า set ถ้าต่างจากเดิมนิดเดียว — กัน loop กับ ResizeObserver (scrollbar โผล่/หาย)
    const cur = useDocStore.getState().zoom
    if (Math.abs(z - cur) > 0.01) setZoom(z, fitMode)
  }, [fitMode, pageOrder, pages, currentPage, setZoom])

  useLayoutEffect(() => {
    recomputeFit()
  }, [recomputeFit])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => recomputeFit())
    ro.observe(el)
    return () => ro.disconnect()
  }, [recomputeFit])

  // ----- ติดตามหน้าปัจจุบันจากการ scroll -----
  const registerEl = useCallback((i: number, el: HTMLDivElement | null) => {
    pageEls.current[i] = el
  }, [])

  const onScroll = useCallback(() => {
    if (programmaticScroll.current) return
    const cont = scrollRef.current
    if (!cont) return
    const mid = cont.scrollTop + cont.clientHeight / 2
    let best = 0
    let bestDist = Infinity
    pageEls.current.forEach((el, i) => {
      if (!el) return
      const center = el.offsetTop + el.offsetHeight / 2
      const d = Math.abs(center - mid)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    if (best !== currentPage) {
      lastReq.current = best // ยอมรับว่าตรงกับ scroll แล้ว → effect จะไม่เด้งซ้ำ
      setCurrentPage(best)
    }
  }, [currentPage, setCurrentPage])

  // เลื่อนไปหน้าเมื่อ currentPage ถูกสั่งจากภายนอก (sidebar/toolbar)
  const scrollToPage = useCallback((i: number) => {
    const el = pageEls.current[i]
    const cont = scrollRef.current
    if (!el || !cont) return
    programmaticScroll.current = true
    cont.scrollTo({ top: el.offsetTop - 20, behavior: 'smooth' })
    setTimeout(() => (programmaticScroll.current = false), 500)
  }, [])

  // เลื่อนไปหน้าเมื่อ currentPage ถูกสั่งจากภายนอก (sidebar/toolbar/search)
  useEffect(() => {
    if (currentPage !== lastReq.current) {
      lastReq.current = currentPage
      scrollToPage(currentPage)
    }
  }, [currentPage, scrollToPage])

  // ----- ค้นหา -----
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen(true)
      } else if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const runSearch = useCallback(
    async (q: string) => {
      setQuery(q)
      if (!doc || !q.trim()) {
        setHits([])
        return
      }
      const found = await searchDocument(doc, q)
      setHits(found)
      setActiveIdx(0)
      if (found.length) gotoHit(found, 0)
    },
    [doc]
  )

  const gotoHit = (list: SearchHit[], idx: number): void => {
    const hit = list[idx]
    if (!hit) return
    const displayIndex = pageOrder.indexOf(hit.pageIndex)
    if (displayIndex >= 0) setCurrentPage(displayIndex) // effect จะเลื่อนให้
  }

  const step = (dir: 1 | -1): void => {
    if (!hits.length) return
    const next = (activeIdx + dir + hits.length) % hits.length
    setActiveIdx(next)
    gotoHit(hits, next)
  }

  const activeHit = hits[activeIdx] ?? null

  return (
    <div className="viewer" ref={scrollRef} onScroll={onScroll} style={{ position: 'relative' }}>
      {searchOpen && (
        <div className="searchbar">
          <input
            autoFocus
            placeholder="ค้นหาข้อความ…"
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') step(e.shiftKey ? -1 : 1)
            }}
          />
          <span className="count">{hits.length ? `${activeIdx + 1}/${hits.length}` : '0'}</span>
          <button onClick={() => step(-1)}>↑</button>
          <button onClick={() => step(1)}>↓</button>
          <button onClick={() => setSearchOpen(false)}>✕</button>
        </div>
      )}

      <div className="pages-column">
        {doc &&
          pageOrder.map((originalIndex, displayIndex) => (
            <PageView
              key={`${originalIndex}`}
              doc={doc}
              displayIndex={displayIndex}
              originalIndex={originalIndex}
              rotation={pages[originalIndex]?.rotation ?? 0}
              zoom={zoom}
              pageHeightPt={pages[originalIndex]?.height ?? 800}
              hits={hits.filter((h) => h.pageIndex === originalIndex)}
              activeHit={activeHit && activeHit.pageIndex === originalIndex ? activeHit : null}
              registerEl={registerEl}
            />
          ))}
      </div>
    </div>
  )
}
