// Viewer-request function: the SvelteKit build (adapter-static) emits one directory per page,
// such as `es/index.html`, `es/about/index.html` and `es/entity/doi/index.html`, and every link in
// the app ends in a slash (`/es/`, `/es/about/`). S3 does not serve a directory index on its own
// (the CloudFront default root object covers only `/`), so this maps the request onto the file.
//
// Rules:
//   "/"                    -> "/index.html" (the redirect stub that sends visitors to a locale)
//   trailing "/"           -> "index.html" appended ("/es/about/" -> "/es/about/index.html")
//   last segment has no "." -> 301 to the same path with a slash ("/es/about" -> "/es/about/"),
//                             the query string kept, so one URL per page is indexed and shared
//   anything with a file extension is passed through unchanged ("/es/__data.json", "/favicon.svg")
function handler(event) {
	var request = event.request;
	var uri = request.uri;

	if (uri.charAt(uri.length - 1) === '/') {
		request.uri = uri + 'index.html';
		return request;
	}

	var lastSegment = uri.slice(uri.lastIndexOf('/') + 1);
	if (lastSegment.indexOf('.') === -1) {
		var query = '';
		var names = Object.keys(request.querystring || {});
		for (var i = 0; i < names.length; i++) {
			var entry = request.querystring[names[i]];
			var values = entry.multiValue
				? entry.multiValue.map(function (v) {
						return v.value;
					})
				: [entry.value];
			for (var j = 0; j < values.length; j++) {
				query += (query ? '&' : '?') + names[i] + (values[j] === '' ? '' : '=' + values[j]);
			}
		}
		return {
			statusCode: 301,
			statusDescription: 'Moved Permanently',
			headers: { location: { value: uri + '/' + query } }
		};
	}

	return request;
}
