const DEBUG = true;

function getParameterByName(name) {
  url = window.location.href;
  name = name.replace(/[\[\]]/g, "\\$&");
  var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function dlog(m) {
  if (!DEBUG) return;
  const t = $('#debug').html();
  const m1 = $('<div/>').text(m.substring(0, 120)).html();
  $('#debug').html(t + '<br/>' + m1);
}

function nogociateHosts(members) {
  var arr = Object.keys(members);
  var idToReset = arr.sort().pop();
  if (idToReset === MYUID) window.location.reload();
}

function setupMemberObserver() {
  var lastHostCount = -1;
  memberRef.on('value', (snap) => {
    if (is_hangup) return;
    const members = snap.val() || {};
    const temp = JSON.stringify(members);
    if (temp.match(/pending/)) return;
    const hostCount = (temp.match(/host/g) || []).length;
    const offererCount = (temp.match(/offerer/g) || []).length;

    // if no one is in the room, ignore
    if (temp.length < 4) {
      lastHostCount = 0;
      return;
    } else if (hostCount === 1) { // if we have one host
      if (lastHostCount === 0 && is_offerer) { // if host have just joined
        window.location.reload(); // reload to send offer to host
      }
    } else if (hostCount === 0) { // the host has left
      if (offererCount === 1) {
        window.location.reload(members); // we become the host
      } else {
        nogociateHosts(members); // if wa have more than 1 offerer
      }
    } else if (hostCount > 1) { // more than 1 host
      nogociateHosts(members); // negociate to become the host
    }
    lastHostCount = hostCount;
  });
}

function selectText(containerid) {
  if (document.selection) { // IE
    var range = document.body.createTextRange();
    range.moveToElementText(document.getElementById(containerid));
    range.select();
  } else if (window.getSelection) {
    var range = document.createRange();
    range.selectNode(document.getElementById(containerid));
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }
}


if (location.href.indexOf('fbclid=') !== -1) {
  location.replace(location.href.replace(/[\?\&]fbclid[^#]+/, ''));
}
