// CHANGE ME: point this to your own spreadsheet to log
// your own data by modifying the function at the bottom.
//
// A simple Google-spreadsheet-based event logging framework.
//
// This is currently set up to log every mousedown and keydown
// event, as well as any events that might be triggered within
// the app by triggering the 'log' event anywhere in the doc
// as follows:
//
// $(element).trigger('log', ['myevent', {key1: val1, key2: val2}]);

var ENABLE_NETWORK_LOGGING = true; // Controls network logging.
var VER = 'A';                     // Labels every entry with ver: "A".

// These event types are intercepted for logging before jQuery handlers.
var EVENT_TYPES_TO_LOG = {
  mousedown: true,
  keydown: true
};

// These event properties are copied to the log if present.
var EVENT_PROPERTIES_TO_LOG = {
  which: true,
  pageX: true,
  pageY: true
};

// This function is called to record some global state on each event.
var GLOBAL_STATE_TO_LOG = function() {
  return {
    visiblefocus: visiblefocus && parseInt(visiblefocus.id.substr(2)),
    curnumber: curnumber
  };
};

(function() {

// A persistent unique id for the user.
var uid = getUniqueId();

// Hooks up all the event listeners.
function hookEventsToLog() {
  // Set up a jQuery event hook.  This intercepts all jQuery
  // event handlers for native events: fix is called before
  // the handler, so we see the state before event processing.
  var originalFix = jQuery.event.fix;
  jQuery.event.fix = function(originalEvent) {
    if (originalEvent.type in EVENT_TYPES_TO_LOG) {
      logEvent(originalEvent);
    }
    return originalFix.call(this, originalEvent);
  };

  // Once the page is loaded, show our own unique id.
  $(function() {
    console.log('Your unique id is', uid);
    $('#bottomtext').html('Logging to the network as <nobr>' + uid + '</nobr>')
  });

  // Listen to 'log' events which are triggered anywhere in the document.
  $(document).on('log', logEvent);
}

// Returns a CSS selector that is descriptive of
// the element, for example, "td.left div" for
// a class-less div within a td of class "left".
function elementDesc(elt) {
  if (elt == document) {
    return 'document';
  } else if (elt == window) {
    return 'window';
  }
  function descArray(elt) {
    var desc = [elt.tagName.toLowerCase()];
    if (elt.id) {
      desc.push('#' + elt.id);
    }
    for (var j = 0; j < elt.classList.length; j++) {
      desc.push('.' + elt.classList[j]);
    }
    return desc;
  }
  var desc = [];
  while (elt && desc.length <= 1) {
    var desc2 = descArray(elt);
    if (desc.length < 1 || desc2.length > 1) {
      desc2.push(' ', desc[0]);
      desc = desc2;
    }
  }
  return desc.join('');
}

// Parse user agent string by looking for recognized substring.
function findFirstString(str, choices) {
  for (var j = 0; j < choices.length; j++) {
    if (str.indexOf(choices[j]) >= 0) {
      return choices[j];
    }
  }
  return '?';
}

// Genrates or remembers a somewhat-unique ID with distilled user-agent info.
function getUniqueId() {
  if (!('uid' in localStorage)) {
    var browser = findFirstString(navigator.userAgent, [
      'Seamonkey', 'Firefox', 'Chromium', 'Chrome', 'Safari', 'OPR', 'Opera',
      'Edge', 'MSIE', 'Blink', 'Webkit', 'Gecko', 'Trident', 'Mozilla']);
    var os = findFirstString(navigator.userAgent, [
      'Android', 'iOS', 'Symbian', 'Blackberry', 'Windows Phone', 'Windows',
      'OS X', 'Linux', 'iOS', 'CrOS']).replace(/ /g, '_');
    var unique = ('' + Math.random()).substr(2);
    localStorage['uid'] = os + '-' + browser + '-' + unique;
  }
  return localStorage['uid'];
}

// Log the given event.
function logEvent(event, customName, customInfo) {
  var time = (new Date).getTime();
  var name = customName || event.type;
  // By default, monitor some global state on every event.
  var infoObj = GLOBAL_STATE_TO_LOG();
  // And monitor a few interesting fields from the event, if present.
  for (var key in EVENT_PROPERTIES_TO_LOG) {
    if (key in event) {
      infoObj[key] = event[key];
    }
  }
  // Let a custom event add fields to the info.
  if (customInfo) {
    $.extend(infoObj, customInfo);
  }
  var info = JSON.stringify(infoObj);
  var target = elementDesc(event.target);
  var state = location.hash;

  if (ENABLE_NETWORK_LOGGING) {
    sendSampleNetworkLog(uid, time, name, target, info, state);
  }
}

// OK, go.
if (ENABLE_NETWORK_LOGGING) {
  hookEventsToLog();
}

})();

/////////////////////////////////////////////////////////////////////////////
// Change the funcion below by substituting in your own "viewform" URL.
/////////////////////////////////////////////////////////////////////////////
//
// 1. Create a Google Form at forms.google.com.
// 2. Set it up to have several "short answer" questions; the example
//    uses six questions called uid, time, name, target, info, and state.
// 3. Run googlesender.py (at goo.gl/jUkahv) to make a sender function
//    that submits to the form, and call that function to log events.
//
// For example, the following code was written as follows:
// curl -sL goo.gl/jUkahv | python - https://docs.google.com/forms/d/e/1FAIpQLSfTGNsP_71n7p7avtvN0o3QK2gaaWEctdk0tN7KKCeuOKZqVQ/viewform >> event-hook.js
//
// If you do not change the function below, your sample data will end up
// in the sample spreadsheet.
//
/////////////////////////////////////////////////////////////////////////////

// sample network log submission function
// submits to the google form at this URL:
// docs.google.com/forms/d/e/1FAIpQLSfTGNsP_71n7p7avtvN0o3QK2gaaWEctdk0tN7KKCeuOKZqVQ/viewform
function sendSampleNetworkLog(
    uid,
    time,
    name,
    target,
    info,
    state) {
  var formid = "e/1FAIpQLSfTGNsP_71n7p7avtvN0o3QK2gaaWEctdk0tN7KKCeuOKZqVQ";
  var data = {
    "entry.46473373": uid,
    "entry.2016200400": time,
    "entry.1995562845": name,
    "entry.161183543": target,
    "entry.1431687220": info,
    "entry.369260068": state
  };
  var params = [];
  for (key in data) {
    params.push(key + "=" + encodeURIComponent(data[key]));
  }
  // Submit the form using an image to avoid CORS warnings.
  (new Image).src = "https://docs.google.com/forms/d/" + formid +
     "/formResponse?" + params.join("&");
}
