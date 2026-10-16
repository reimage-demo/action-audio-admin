import { imageManifest } from './image-manifest.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function imageMarkup(file,alt,{sizes='100vw',eager=false,className='',priority=eager?'high':'auto'}={}) {
 const image=imageManifest[file];
 if(!image)throw new Error(`Missing optimized image: ${file}`);
 const fallback=image.variants.find(v=>v.width>=800)||image.variants.at(-1);
 const sources=format=>image.variants.map(v=>`${v[format]} ${v.width}w`).join(', ');
 return `<picture${className?` class="${escape(className)}"`:''}><source type="image/avif" srcset="${sources('avif')}" sizes="${escape(sizes)}"><img src="${fallback.webp}" srcset="${sources('webp')}" sizes="${escape(sizes)}" width="${image.width}" height="${image.height}" alt="${escape(alt)}" loading="${eager?'eager':'lazy'}" fetchpriority="${priority}" decoding="async"></picture>`;
}
