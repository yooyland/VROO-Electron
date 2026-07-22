const listeners=new Map();
export function on(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return()=>listeners.get(name)?.delete(fn)}
export function emit(name,detail){listeners.get(name)?.forEach(fn=>fn(detail))}
