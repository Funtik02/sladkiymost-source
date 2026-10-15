import { highlightParts } from '../utils/search'

export default function Highlight({ text, query }) {
    return highlightParts(text, query).map((part, index) =>
        part.match ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>
    )
}
