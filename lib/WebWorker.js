;(function(window) {
	const webWorkerScript = `const postMsg = (url, blob) => self.postMessage(url)
const checkStatus = function(response) {
	if (response.ok) return response

	console.error(response.statusText)
	throw response
}
self.addEventListener('message', event => {
	const url = event.data,
		bound = postMsg.bind(undefined, url)
	self.fetch(url).then(checkStatus).then(bound).catch(() => bound)
})
`

	let workerBlob = null
	window.getWorkerBlob = function() {
		if (workerBlob === null) workerBlob = URL.createObjectURL(new Blob([webWorkerScript], { type: 'application/javascript' }))
		return workerBlob
	}

	let worker = null
	window.getWorker = function() {
		if (worker !== null) return worker
		worker = new Worker(window.getWorkerBlob())
		return worker
	}
})(window)
