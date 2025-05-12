function read_cluster_data(data) {
  const re = /(?<index>\d+)(?<type>[Bbdefisxyz])(?<value>.+)/;

  const match = data.match(re);

  if (match) {
    const { index, type, value } = match.groups;

    let value2 = value;

    switch (type) {
      case 'f':
      case 'd':
        value2 = parseFloat(value);
        break;
      case 'i':
      case 'x':
      case 'y':
      case 'e':
        value2 = parseInt(value, 10);
        break;
      case 'b':
        value2 = value === 'true';
        break;
    }

    return { index, type, value: value2 };
  }

  return data;
}

function read_cluster(data) {
  const re = /(?<index>\d+)m(?<count>\d+)/;

  const cluster = {};

  const name = data[0];
  const match = name.match(re);

  if (match) {
    const { groups } = match;
    const count = Number(groups.count);

    cluster.name = name;
    cluster.count = count;
    cluster.items = [];

    const content = data.slice(1, 1 + count);

    while (content.length > 0) {
      const items = read_cluster(content);
      if (items === null) {
        cluster.items.push(read_cluster_data(content[0]));
        content.shift();
      } else {
        cluster.items.push(items);
        content.splice(0, items.count + 1);
      }
    }

    return cluster;
  }

  return null;
}

// Parses the protobuf encoded in maps URLs
function deproto(str) {
  const data = str.split('!');
  const tree = [];

  if (data[0] === '') {
    data.shift();
  }

  let i = 0;

  while (i < data.length) {
    const cluster = read_cluster(data.slice(i));

    if (cluster) {
      tree.push(cluster);
      i += cluster.count;
    } else {
      tree.push(read_cluster_data(data[i]));
      i += 1;
    }
  }

  return tree;
}

function handleInterceptedOpen(method, uri) {
  if (uri.startsWith('/maps/preview/reveal')) {
    const [url, params] = uri.split('?');
    
    if (params) {
      const pb = params
        .split('&')
        .map((v) => v.split('='))
        .find((e) => e[0] === 'pb');

      if (!pb) {
        return;
      }

      const result = deproto(pb[1]);

      if (!(result && result[2] && result[2].items)) {
        return;
      }

      const latlng = result[2];

      if (latlng.count !== 2) {
        return;
      }

      const lng = latlng.items[0].value;
      const lat = latlng.items[1].value;

      window.postMessage({ type: 'seeker-xhr-event', lat, lng }, '*');
    }
  }
}

(function() {
  const OriginalXMLHttpRequest = window.XMLHttpRequest;

  class XMLHttpRequest extends OriginalXMLHttpRequest {
    open(method, url, async, user, password) {
      handleInterceptedOpen(method, url);
      return super.open(method, url, async, user, password);
    }
  }

  window.XMLHttpRequest = XMLHttpRequest;
})();
