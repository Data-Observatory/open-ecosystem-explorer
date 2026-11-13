// Runs synchronously in the head of every page, before first paint. It is plain JavaScript (no
// module) and the only code that can load Google Tag Manager. Analytics are on by default: the
// container loads unless the visitor stored a current "denied" choice, and the notice in the page
// lets the visitor turn it off at any time. The stored format matches src/lib/consent/core.ts:
// {"v":1,"choice":"granted"|"denied","date":"YYYY-MM-DD"}.
//
// Which tags fire (for example Google Analytics 4) is decided inside the container, not here. This
// script sets Consent Mode v2 (analytics_storage follows the choice; ad_storage, ad_user_data and
// ad_personalization are always denied) before the container loads, so every tag in the container
// has to be configured to respect Consent Mode (see docs/analytics.md).
(function () {
	var STORAGE_KEY = 'oee-consent';
	var VERSION = 1;
	var MAX_AGE_DAYS = 365;
	var CONTAINER_ID = 'GTM-M9NXQLBC';
	// Locale path segments (the same list as src/i18n/locales.ts). The bare root page only redirects
	// to one of them and carries no notice, so the container is not loaded there.
	var LOCALES = ['es', 'en'];
	// Optional: the Google Analytics 4 measurement id of the property the container reports to.
	// The container hides it, so it is empty by default. When set (for example 'G-XXXXXXXXXX'),
	// turning analytics off also sets the documented ga-disable switch and also expires that
	// property's _ga_<id> cookie on the parent domains. Left empty, only the cookies on the exact
	// host are expired, because a parent domain may belong to another property.
	var GA_MEASUREMENT_ID = '';
	var PROPERTY_COOKIE = GA_MEASUREMENT_ID ? '_ga_' + GA_MEASUREMENT_ID.replace('G-', '') : '';
	var DISABLE_FLAG = GA_MEASUREMENT_ID ? 'ga-disable-' + GA_MEASUREMENT_ID : '';
	var loaded = false;

	// Read by the stylesheet to hide the no-JavaScript blocks.
	document.documentElement.classList.add('js');

	window.dataLayer = window.dataLayer || [];
	function gtag() {
		window.dataLayer.push(arguments);
	}
	window.gtag = gtag;

	function consentState(value) {
		return {
			analytics_storage: value,
			ad_storage: 'denied',
			ad_user_data: 'denied',
			ad_personalization: 'denied'
		};
	}
	function storage() {
		try {
			return window.localStorage;
		} catch {
			return null;
		}
	}

	// The stored choice ("granted" or "denied"), or null when missing, malformed, from another
	// version or older than MAX_AGE_DAYS.
	function storedChoice() {
		try {
			var value = JSON.parse(storage().getItem(STORAGE_KEY));
			if (!value || value.v !== VERSION) return null;
			if (value.choice !== 'granted' && value.choice !== 'denied') return null;
			var parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.date);
			if (!parts) return null;
			var year = Number(parts[1]);
			var month = Number(parts[2]) - 1;
			var day = Number(parts[3]);
			var then = new Date(year, month, day);
			if (then.getFullYear() !== year || then.getMonth() !== month || then.getDate() !== day) {
				return null;
			}
			var now = new Date();
			var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
			var age = (today - Date.UTC(year, month, day)) / 86400000;
			return age > MAX_AGE_DAYS ? null : value.choice;
		} catch {
			return null;
		}
	}

	function pad(number) {
		return (number < 10 ? '0' : '') + number;
	}

	function store(choice) {
		try {
			var now = new Date();
			var date = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
			storage().setItem(STORAGE_KEY, JSON.stringify({ v: VERSION, choice: choice, date: date }));
		} catch {
			// Blocked storage: the choice then only lasts for this page view.
		}
	}

	// The standard Tag Manager bootstrap, with the container id of this site.
	function load() {
		if (loaded) return;
		loaded = true;
		gtag('js', new Date());
		window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
		var script = document.createElement('script');
		script.async = true;
		script.src = 'https://www.googletagmanager.com/gtm.js?id=' + CONTAINER_ID;
		document.head.appendChild(script);
	}

	// Expires the Google Analytics cookies (_ga, _ga_<id>, _gid, _gat*). They are always expired
	// without a domain attribute and with the exact host. A parent domain may hold cookies of another
	// property, so a parent domain is only touched for the cookie of this property, and only when
	// GA_MEASUREMENT_ID identifies it.
	function deleteCookies() {
		try {
			var names = [];
			document.cookie.split(';').forEach(function (pair) {
				var name = pair.split('=')[0].trim();
				if (/^_(ga|gid|gat)/.test(name) && names.indexOf(name) < 0) names.push(name);
			});
			var host = window.location.hostname;
			var labels = host.split('.');
			var parents = [];
			for (var start = 1; start < labels.length; start++) {
				if (labels.length - start >= 2) parents.push(labels.slice(start).join('.'));
			}
			function expire(name, domain) {
				document.cookie =
					name +
					'=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' +
					(domain ? '; domain=' + domain : '');
			}
			names.forEach(function (name) {
				expire(name, '');
				expire(name, host);
				if (PROPERTY_COOKIE && name === PROPERTY_COOKIE) {
					parents.forEach(function (domain) {
						expire(name, domain);
					});
				}
			});
		} catch {
			// Nothing to delete when cookies are not available.
		}
	}

	function setDisabled(value) {
		if (DISABLE_FLAG) window[DISABLE_FLAG] = value;
	}

	function stop() {
		setDisabled(true);
		gtag('consent', 'update', consentState('denied'));
		deleteCookies();
	}

	window.oeeConsent = {
		// Keeps analytics on. After a denied choice in this page view it also loads the container.
		grant: function () {
			store('granted');
			setDisabled(false);
			gtag('consent', 'update', consentState('granted'));
			load();
		},
		// Turns analytics off: stored for later visits, and Consent Mode is set to denied in this
		// page view (a container that already loaded cannot be unloaded, only told to stop).
		deny: function () {
			store('denied');
			stop();
		},
		isLoaded: function () {
			return loaded;
		}
	};

	// The bare root page only redirects to /es or /en. The container stays off there so the redirect
	// does not count a second page view for the same visit.
	var isLocalePage = new RegExp('(^|/)(' + LOCALES.join('|') + ')(/|$)').test(
		window.location.pathname
	);

	if (storedChoice() === 'denied') {
		gtag('consent', 'default', consentState('denied'));
		setDisabled(true);
	} else {
		gtag('consent', 'default', consentState('granted'));
		if (isLocalePage) load();
	}
})();
