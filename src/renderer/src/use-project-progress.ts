import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProjectProgressSnapshot } from '../../shared/project-progress'

export function useProjectProgress(projectId?: string, includeArchivedProjects = false) {
  const [snapshot,setSnapshot]=useState<ProjectProgressSnapshot|null>(null)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const request=useRef(0)
  const refresh=useCallback(async()=>{
    if(!window.forgeDesk?.getProjectProgress){setError('请在 ForgeDesk 桌面应用中使用项目进度');setLoading(false);return}
    const revision=++request.current
    try{
      const next=await window.forgeDesk.getProjectProgress({projectId,includeArchivedProjects})
      if(revision===request.current){setSnapshot(next);setError('')}
      return next
    }catch(error){if(revision===request.current)setError(error instanceof Error?error.message:String(error))}
    finally{if(revision===request.current)setLoading(false)}
  },[projectId,includeArchivedProjects])
  useEffect(()=>{
    setLoading(true); setSnapshot(null); void refresh()
    let timer:ReturnType<typeof setTimeout>|undefined
    const update=()=>{clearTimeout(timer);timer=setTimeout(()=>void refresh(),80)}
    const unsubscribe=window.forgeDesk?.onProjectProgressUpdated?.(update)
    window.addEventListener('focus',update)
    const interval=setInterval(update,60000)
    return()=>{request.current++;unsubscribe?.();clearTimeout(timer);clearInterval(interval);window.removeEventListener('focus',update)}
  },[refresh])
  return {snapshot,error,loading,refresh}
}
