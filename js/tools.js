(function() {
  'use strict';

  var dataInput = document.getElementById('data-input');
  if (!dataInput) return;

  var dataOutput = document.getElementById('data-output');
  var dataHighlightOutput = document.getElementById('data-highlight-output');
  var dataOutputFormat = document.getElementById('data-output-format');
  var dataStatus = document.getElementById('data-status');
  var timestampInput = document.getElementById('timestamp-input');
  var datetimeInput = document.getElementById('datetime-input');
  var timeStatus = document.getElementById('time-status');
  var colorPicker = document.getElementById('color-picker');
  var colorHexInput = document.getElementById('color-hex');
  var colorPalette = document.getElementById('color-palette');
  var colorStatus = document.getElementById('color-status');
  var urlInput = document.getElementById('url-input');
  var urlOutput = document.getElementById('url-output');
  var urlStatus = document.getElementById('url-status');
  var codecInput = document.getElementById('codec-input');
  var codecOutput = document.getElementById('codec-output');
  var codecStatus = document.getElementById('codec-status');
  var sqlInput = document.getElementById('sql-input');
  var sqlOutput = document.getElementById('sql-output');
  var sqlStatus = document.getElementById('sql-status');
  var toolNavItems = document.querySelectorAll('[data-tool-target]');
  var toolPanels = document.querySelectorAll('[data-tool-panel]');
  var parseTimer;

  function activateTool(toolId, updateHash) {
    var matched = false;

    Array.prototype.forEach.call(toolPanels, function(panel) {
      var isActive = panel.id === toolId;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
      if (isActive) matched = true;
    });

    if (!matched) return false;

    Array.prototype.forEach.call(toolNavItems, function(item) {
      var isActive = item.getAttribute('data-tool-target') === toolId;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-selected', isActive ? 'true' : 'false');
      item.tabIndex = isActive ? 0 : -1;
    });

    if (updateHash && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '#' + toolId);
    }
    return true;
  }

  Array.prototype.forEach.call(toolNavItems, function(item) {
    item.addEventListener('click', function() {
      activateTool(item.getAttribute('data-tool-target'), true);
    });
  });

  var initialTool = window.location.hash.slice(1);
  if (!activateTool(initialTool, false)) activateTool('data-formatter', false);

  window.addEventListener('hashchange', function() {
    activateTool(window.location.hash.slice(1), false);
  });

  function setStatus(element, message, type) {
    element.textContent = message;
    element.className = 'tool-status' + (type ? ' ' + type : '');
  }

  function PythonLiteralParser(source) {
    this.source = source;
    this.position = 0;
  }

  PythonLiteralParser.prototype.peek = function() {
    return this.source[this.position];
  };

  PythonLiteralParser.prototype.skipWhitespace = function() {
    while (/\s/.test(this.peek() || '')) this.position += 1;
  };

  PythonLiteralParser.prototype.error = function(message) {
    throw new Error(message + '（位置 ' + (this.position + 1) + '）');
  };

  PythonLiteralParser.prototype.parse = function() {
    this.skipWhitespace();
    var value = this.parseValue();
    this.skipWhitespace();
    if (this.position !== this.source.length) this.error('存在多余内容');
    return value;
  };

  PythonLiteralParser.prototype.parseValue = function() {
    this.skipWhitespace();
    var character = this.peek();
    if (character === '{') return this.parseObject();
    if (character === '[') return this.parseSequence('[', ']');
    if (character === '(') return this.parseSequence('(', ')');
    if (character === '"' || character === "'") return this.parseString();
    if (character === '-' || character === '+' || /[0-9]/.test(character || '')) return this.parseNumber();
    return this.parseKeyword();
  };

  PythonLiteralParser.prototype.parseObject = function() {
    var result = Object.create(null);
    this.position += 1;
    this.skipWhitespace();
    if (this.peek() === '}') {
      this.position += 1;
      return result;
    }

    while (this.position < this.source.length) {
      var key = this.parseValue();
      if (typeof key !== 'string' && typeof key !== 'number' && typeof key !== 'boolean') {
        this.error('字典键必须是字符串、数字或布尔值');
      }
      this.skipWhitespace();
      if (this.peek() !== ':') this.error('字典键后缺少冒号');
      this.position += 1;
      result[String(key)] = this.parseValue();
      this.skipWhitespace();
      if (this.peek() === '}') {
        this.position += 1;
        return result;
      }
      if (this.peek() !== ',') this.error('字典项之间缺少逗号');
      this.position += 1;
      this.skipWhitespace();
      if (this.peek() === '}') {
        this.position += 1;
        return result;
      }
    }
    this.error('字典缺少右花括号');
  };

  PythonLiteralParser.prototype.parseSequence = function(opening, closing) {
    var result = [];
    if (this.peek() !== opening) this.error('序列格式错误');
    this.position += 1;
    this.skipWhitespace();
    if (this.peek() === closing) {
      this.position += 1;
      return result;
    }

    while (this.position < this.source.length) {
      result.push(this.parseValue());
      this.skipWhitespace();
      if (this.peek() === closing) {
        this.position += 1;
        return result;
      }
      if (this.peek() !== ',') this.error('序列项之间缺少逗号');
      this.position += 1;
      this.skipWhitespace();
      if (this.peek() === closing) {
        this.position += 1;
        return result;
      }
    }
    this.error('序列缺少结束符号');
  };

  PythonLiteralParser.prototype.parseString = function() {
    var quote = this.peek();
    var result = '';
    this.position += 1;

    while (this.position < this.source.length) {
      var character = this.source[this.position++];
      if (character === quote) return result;
      if (character !== '\\') {
        result += character;
        continue;
      }
      if (this.position >= this.source.length) this.error('字符串转义不完整');
      var escaped = this.source[this.position++];
      var escapes = {n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '\\': '\\', "'": "'", '"': '"'};
      if (escaped === 'u') {
        var hex = this.source.slice(this.position, this.position + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.error('Unicode 转义无效');
        result += String.fromCharCode(parseInt(hex, 16));
        this.position += 4;
      } else {
        result += Object.prototype.hasOwnProperty.call(escapes, escaped) ? escapes[escaped] : escaped;
      }
    }
    this.error('字符串缺少结束引号');
  };

  PythonLiteralParser.prototype.parseNumber = function() {
    var remaining = this.source.slice(this.position);
    var match = remaining.match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (!match) this.error('数字格式无效');
    this.position += match[0].length;
    var value = Number(match[0]);
    if (!Number.isFinite(value)) this.error('数字超出有效范围');
    return value;
  };

  PythonLiteralParser.prototype.parseKeyword = function() {
    var remaining = this.source.slice(this.position);
    var keywords = {True: true, False: false, None: null, true: true, false: false, null: null};
    var match = remaining.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (!match || !Object.prototype.hasOwnProperty.call(keywords, match[0])) {
      this.error('只支持安全的 Python 字面量');
    }
    this.position += match[0].length;
    return keywords[match[0]];
  };

  function parseData(source) {
    var text = source.trim();
    if (!text) throw new Error('请输入 JSON 或 Python 字典');
    try {
      return {value: JSON.parse(text), type: 'JSON'};
    } catch (jsonError) {
      return {value: new PythonLiteralParser(text).parse(), type: 'Python 字典'};
    }
  }

  function resetHighlightedOutput() {
    dataHighlightOutput.textContent = '';
    var placeholder = document.createElement('span');
    placeholder.className = 'json-placeholder';
    placeholder.textContent = '解析结果会自动显示在这里';
    dataHighlightOutput.appendChild(placeholder);
  }

  function renderHighlightedJson(jsonText) {
    dataHighlightOutput.textContent = '';

    // Keep large payloads responsive by avoiding thousands of highlight nodes.
    if (jsonText.length > 300000) {
      dataHighlightOutput.textContent = jsonText;
      return false;
    }

    var fragment = document.createDocumentFragment();
    var tokenPattern = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"\s*:|"(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
    var cursor = 0;
    var match;

    while ((match = tokenPattern.exec(jsonText)) !== null) {
      if (match.index > cursor) {
        fragment.appendChild(document.createTextNode(jsonText.slice(cursor, match.index)));
      }

      var token = match[0];
      var span = document.createElement('span');
      if (/^".*"\s*:$/.test(token)) span.className = 'json-key';
      else if (token.charAt(0) === '"') span.className = 'json-string';
      else if (token === 'true' || token === 'false') span.className = 'json-boolean';
      else if (token === 'null') span.className = 'json-null';
      else span.className = 'json-number';
      span.textContent = token;
      fragment.appendChild(span);
      cursor = tokenPattern.lastIndex;
    }

    if (cursor < jsonText.length) {
      fragment.appendChild(document.createTextNode(jsonText.slice(cursor)));
    }
    dataHighlightOutput.appendChild(fragment);
    return true;
  }

  function stringifyPython(value, compact, depth) {
    depth = depth || 0;
    if (value === null) return 'None';
    if (value === true) return 'True';
    if (value === false) return 'False';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number') return String(value);

    var indent = compact ? '' : new Array(depth + 1).join('  ');
    var childIndent = compact ? '' : new Array(depth + 2).join('  ');
    var separator = compact ? ', ' : ',\n';
    if (Array.isArray(value)) {
      if (!value.length) return '[]';
      var items = value.map(function(item) {
        return childIndent + stringifyPython(item, compact, depth + 1);
      });
      return compact ? '[' + items.join(separator) + ']' : '[\n' + items.join(separator) + '\n' + indent + ']';
    }

    var keys = Object.keys(value);
    if (!keys.length) return '{}';
    var entries = keys.map(function(key) {
      return childIndent + JSON.stringify(key) + ': ' + stringifyPython(value[key], compact, depth + 1);
    });
    return compact ? '{' + entries.join(separator) + '}' : '{\n' + entries.join(separator) + '\n' + indent + '}';
  }

  function showDataResult(value, type, compact, sourceType) {
    var formatted = type === 'Python 字典'
      ? stringifyPython(value, compact, 0)
      : JSON.stringify(value, null, compact ? 0 : 2);
    dataOutput.value = formatted;
    dataHighlightOutput.textContent = formatted;
    var highlighted = true;
    if (type === 'JSON') highlighted = renderHighlightedJson(formatted);
    dataOutputFormat.textContent = type + (type === 'JSON' ? ' · 语法高亮' : ' · Python 字面量');
    var message = sourceType ? sourceType + ' → ' + type + ' 转换成功。' : '已识别为' + type + '，格式化成功。';
    if (!highlighted) message += ' 内容较大，已关闭高亮以保持流畅。';
    setStatus(dataStatus, message, 'success');
  }

  function renderData(compact) {
    try {
      var parsed = parseData(dataInput.value);
      showDataResult(parsed.value, 'JSON', compact, parsed.type === 'JSON' ? '' : parsed.type);
    } catch (error) {
      dataOutput.value = '';
      resetHighlightedOutput();
      setStatus(dataStatus, error.message, 'error');
    }
  }

  function convertJsonToPython() {
    try {
      var value = JSON.parse(dataInput.value.trim());
      showDataResult(value, 'Python 字典', false, 'JSON');
    } catch (error) {
      dataOutput.value = '';
      resetHighlightedOutput();
      setStatus(dataStatus, '请输入有效的 JSON：' + error.message, 'error');
    }
  }

  function convertPythonToJson() {
    try {
      var value = new PythonLiteralParser(dataInput.value.trim()).parse();
      showDataResult(value, 'JSON', false, 'Python 字典');
    } catch (error) {
      dataOutput.value = '';
      resetHighlightedOutput();
      setStatus(dataStatus, '请输入有效的 Python 字典：' + error.message, 'error');
    }
  }

  function copyText(text, statusElement, successMessage) {
    if (!text) {
      setStatus(statusElement, '没有可复制的内容。', 'error');
      return;
    }
    navigator.clipboard.writeText(text).then(function() {
      setStatus(statusElement, successMessage, 'success');
    }).catch(function() {
      setStatus(statusElement, '复制失败，请手动选择复制。', 'error');
    });
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function normalizeHex(value) {
    var hex = value.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
    }
    return /^[0-9a-fA-F]{6}$/.test(hex) ? '#' + hex.toUpperCase() : null;
  }

  function hexToRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  function rgbToHex(rgb) {
    return '#' + [rgb.r, rgb.g, rgb.b].map(function(value) {
      return Math.round(value).toString(16).padStart(2, '0');
    }).join('').toUpperCase();
  }

  function mixColors(base, target, amount) {
    return rgbToHex({
      r: base.r + (target.r - base.r) * amount,
      g: base.g + (target.g - base.g) * amount,
      b: base.b + (target.b - base.b) * amount
    });
  }

  function rgbToHsl(rgb) {
    var r = rgb.r / 255;
    var g = rgb.g / 255;
    var b = rgb.b / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var delta = max - min;
    var hue = 0;
    var lightness = (max + min) / 2;
    var saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
    if (delta !== 0) {
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
    }
    if (hue < 0) hue += 360;
    return {h: Math.round(hue), s: Math.round(saturation * 100), l: Math.round(lightness * 100)};
  }

  function readableTextColor(rgb) {
    var luminance = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return luminance > 150 ? '#0F172A' : '#FFFFFF';
  }

  function buildPalette(hex) {
    var base = hexToRgb(hex);
    var white = {r: 255, g: 255, b: 255};
    var black = {r: 0, g: 0, b: 0};
    var stops = [
      {name: '50', color: mixColors(base, white, 0.92)},
      {name: '100', color: mixColors(base, white, 0.82)},
      {name: '200', color: mixColors(base, white, 0.66)},
      {name: '300', color: mixColors(base, white, 0.48)},
      {name: '400', color: mixColors(base, white, 0.25)},
      {name: '500', color: hex},
      {name: '600', color: mixColors(base, black, 0.14)},
      {name: '700', color: mixColors(base, black, 0.28)},
      {name: '800', color: mixColors(base, black, 0.4)},
      {name: '900', color: mixColors(base, black, 0.52)}
    ];
    return stops;
  }

  function renderColorPalette(hex) {
    var rgb = hexToRgb(hex);
    var hsl = rgbToHsl(rgb);
    var stops = buildPalette(hex);
    colorPalette.textContent = '';
    stops.forEach(function(stop) {
      var button = document.createElement('button');
      var stopRgb = hexToRgb(stop.color);
      button.type = 'button';
      button.className = 'color-swatch';
      button.style.backgroundColor = stop.color;
      button.style.color = readableTextColor(stopRgb);
      button.setAttribute('data-color', stop.color);
      button.setAttribute('aria-label', '复制色阶 ' + stop.name + '：' + stop.color);
      var name = document.createElement('strong');
      name.textContent = stop.name;
      var value = document.createElement('span');
      value.textContent = stop.color;
      button.appendChild(name);
      button.appendChild(value);
      colorPalette.appendChild(button);
    });
    document.getElementById('color-base-value').textContent = hex;
    document.getElementById('color-rgb-value').textContent = 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')';
    document.getElementById('color-hsl-value').textContent = 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)';
    colorPicker.value = hex.toLowerCase();
    colorHexInput.value = hex;
    return stops;
  }

  function updateColor(value) {
    var hex = normalizeHex(value);
    if (!hex) {
      setStatus(colorStatus, '请输入有效的 HEX 颜色，例如 #0284C7。', 'error');
      return;
    }
    renderColorPalette(hex);
    setStatus(colorStatus, '色阶已更新，点击任意色块即可复制。', 'success');
  }

  function toDatetimeLocal(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
  }

  function renderTime(milliseconds) {
    var date = new Date(milliseconds);
    if (!Number.isFinite(milliseconds) || Number.isNaN(date.getTime())) {
      setStatus(timeStatus, '请输入有效时间戳或日期。', 'error');
      return;
    }
    document.getElementById('time-local').textContent = date.toLocaleString(undefined, {hour12: false});
    document.getElementById('time-utc').textContent = date.toISOString();
    document.getElementById('time-seconds').textContent = String(Math.floor(milliseconds / 1000));
    document.getElementById('time-milliseconds').textContent = String(Math.trunc(milliseconds));
    timestampInput.value = String(Math.trunc(milliseconds));
    datetimeInput.value = toDatetimeLocal(date);
    setStatus(timeStatus, '转换成功，时间按当前浏览器时区显示。', 'success');
  }

  function timestampToDate() {
    var text = timestampInput.value.trim();
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) {
      setStatus(timeStatus, '时间戳只能包含数字。', 'error');
      return;
    }
    var value = Number(text);
    renderTime(Math.abs(value) < 100000000000 ? value * 1000 : value);
  }

  function requireInput(element, message) {
    var value = element.value;
    if (!value.trim()) throw new Error(message);
    return value;
  }

  function runTextTransform(input, output, status, transform, successMessage) {
    try {
      output.value = transform(requireInput(input, '请输入需要转换的内容。'));
      setStatus(status, successMessage, 'success');
    } catch (error) {
      output.value = '';
      setStatus(status, error.message || '转换失败，请检查输入内容。', 'error');
    }
  }

  function getQueryText(value) {
    var text = value.trim();
    var questionMark = text.indexOf('?');
    if (questionMark !== -1) text = text.slice(questionMark + 1);
    var hash = text.indexOf('#');
    if (hash !== -1) text = text.slice(0, hash);
    return text.replace(/^\?/, '');
  }

  function parseQuery(value) {
    var query = getQueryText(value);
    if (!query) throw new Error('未找到 Query 参数。');
    var result = Object.create(null);
    new URLSearchParams(query).forEach(function(itemValue, key) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) result[key] = itemValue;
      else if (Array.isArray(result[key])) result[key].push(itemValue);
      else result[key] = [result[key], itemValue];
    });
    return JSON.stringify(result, null, 2);
  }

  function buildQuery(value) {
    var parsed;
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      throw new Error('请输入有效的 JSON 对象。');
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('Query 数据必须是 JSON 对象。');
    }
    var params = new URLSearchParams();
    Object.keys(parsed).forEach(function(key) {
      var values = Array.isArray(parsed[key]) ? parsed[key] : [parsed[key]];
      values.forEach(function(item) {
        params.append(key, item === null ? '' : String(item));
      });
    });
    return params.toString();
  }

  function textToBase64(value) {
    var bytes = new TextEncoder().encode(value);
    var binary = '';
    var chunkSize = 32768;
    for (var offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  function base64ToText(value) {
    var normalized = value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) {
      throw new Error('请输入有效的 Base64 内容。');
    }
    while (normalized.length % 4) normalized += '=';
    var binary;
    try {
      binary = atob(normalized);
    } catch (error) {
      throw new Error('请输入有效的 Base64 内容。');
    }
    var bytes = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    try {
      return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
    } catch (error) {
      throw new Error('Base64 解码结果不是有效的 UTF-8 文本。');
    }
  }

  function textToUnicode(value) {
    var result = '';
    for (var index = 0; index < value.length; index += 1) {
      var code = value.charCodeAt(index);
      if (code >= 32 && code <= 126 && code !== 92) result += value.charAt(index);
      else result += '\\u' + code.toString(16).toUpperCase().padStart(4, '0');
    }
    return result;
  }

  function unicodeToText(value) {
    return value
      .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, function(match, hex) {
        var codePoint = parseInt(hex, 16);
        if (codePoint > 0x10FFFF) throw new Error('Unicode 码点超出有效范围。');
        return String.fromCodePoint(codePoint);
      })
      .replace(/\\u([0-9a-fA-F]{4})/g, function(match, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      });
  }

  function protectSqlParts(value) {
    var parts = [];
    var pattern = /(?:'(?:''|\\.|[^'\\])*'|"(?:""|\\.|[^"\\])*"|`(?:``|[^`])*`|\[(?:\]\]|[^\]])*\]|--[^\r\n]*|#[^\r\n]*|\/\*[\s\S]*?\*\/)/g;
    return {
      text: value.replace(pattern, function(match) {
        var token = '\uE000' + parts.length + '\uE001';
        parts.push(match);
        return token;
      }),
      parts: parts
    };
  }

  function restoreSqlParts(value, parts) {
    return value.replace(/\uE000(\d+)\uE001/g, function(match, index) {
      return parts[Number(index)];
    });
  }

  function normalizeSqlKeywords(value) {
    var keywords = 'select|distinct|from|where|group by|order by|having|limit|offset|fetch|insert into|update|delete from|set|values|returning|union all|union|intersect|except|left outer join|right outer join|full outer join|left join|right join|full join|inner join|cross join|join|on|and|or|as|case|when|then|else|end|is null|is not null|in|not in|exists|between|like|asc|desc';
    var pattern = new RegExp('\\b(' + keywords.replace(/ /g, '\\s+') + ')\\b', 'gi');
    return value.replace(pattern, function(keyword) {
      return keyword.replace(/\s+/g, ' ').toUpperCase();
    });
  }

  function formatSql(value) {
    var protectedSql = protectSqlParts(value.trim());
    var sql = protectedSql.text.replace(/\s+/g, ' ').trim();
    if (!sql) throw new Error('请输入需要格式化的 SQL。');
    sql = normalizeSqlKeywords(sql);
    sql = sql
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s*;\s*/g, ';\n')
      .replace(/\s+(SELECT|INSERT INTO|UPDATE|DELETE FROM|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|FETCH|RETURNING|UNION ALL|UNION|INTERSECT|EXCEPT)\b/g, '\n$1')
      .replace(/\s+(LEFT OUTER JOIN|RIGHT OUTER JOIN|FULL OUTER JOIN|LEFT JOIN|RIGHT JOIN|FULL JOIN|INNER JOIN|CROSS JOIN|JOIN)\b/g, '\n$1')
      .replace(/\s+(AND|OR)\s+/g, '\n  $1 ')
      .replace(/\s+(ON|SET|VALUES)\s+/g, '\n  $1 ')
      .replace(/\n{2,}/g, '\n')
      .trim();
    return restoreSqlParts(sql, protectedSql.parts);
  }

  function compactSql(value) {
    var protectedSql = protectSqlParts(value.trim());
    if (!protectedSql.text) throw new Error('请输入需要压缩的 SQL。');
    var sql = protectedSql.text.replace(/\s+/g, ' ').replace(/\s*([,;()])\s*/g, '$1').trim();
    return restoreSqlParts(sql, protectedSql.parts);
  }

  document.getElementById('format-data').addEventListener('click', function() { renderData(false); });
  document.getElementById('compact-data').addEventListener('click', function() { renderData(true); });
  document.getElementById('json-to-python').addEventListener('click', convertJsonToPython);
  document.getElementById('python-to-json').addEventListener('click', convertPythonToJson);
  document.getElementById('copy-data').addEventListener('click', function() {
    copyText(dataOutput.value, dataStatus, '已复制格式化结果。');
  });
  document.getElementById('clear-data').addEventListener('click', function() {
    dataInput.value = '';
    dataOutput.value = '';
    dataOutputFormat.textContent = '标准 JSON · 语法高亮';
    resetHighlightedOutput();
    setStatus(dataStatus, '', '');
    dataInput.focus();
  });
  dataInput.addEventListener('input', function() {
    window.clearTimeout(parseTimer);
    parseTimer = window.setTimeout(function() {
      if (dataInput.value.trim()) renderData(false);
      else {
        dataOutput.value = '';
        resetHighlightedOutput();
        setStatus(dataStatus, '', '');
      }
    }, 350);
  });

  document.getElementById('timestamp-now').addEventListener('click', function() { renderTime(Date.now()); });
  document.getElementById('timestamp-convert').addEventListener('click', timestampToDate);
  timestampInput.addEventListener('change', timestampToDate);
  document.getElementById('datetime-convert').addEventListener('click', function() {
    var milliseconds = new Date(datetimeInput.value).getTime();
    renderTime(milliseconds);
  });
  document.getElementById('copy-timestamp').addEventListener('click', function() {
    copyText(document.getElementById('time-milliseconds').textContent, timeStatus, '已复制毫秒时间戳。');
  });

  colorPicker.addEventListener('input', function() { updateColor(colorPicker.value); });
  colorHexInput.addEventListener('input', function() {
    if (normalizeHex(colorHexInput.value)) updateColor(colorHexInput.value);
  });
  colorHexInput.addEventListener('change', function() { updateColor(colorHexInput.value); });
  document.getElementById('random-color').addEventListener('click', function() {
    var value = '#' + Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0').toUpperCase();
    updateColor(value);
  });
  colorPalette.addEventListener('click', function(event) {
    var swatch = event.target.closest('[data-color]');
    if (!swatch) return;
    copyText(swatch.getAttribute('data-color'), colorStatus, '已复制 ' + swatch.getAttribute('data-color') + '。');
  });
  document.getElementById('copy-color-css').addEventListener('click', function() {
    var hex = normalizeHex(colorHexInput.value);
    if (!hex) {
      setStatus(colorStatus, '请先输入有效的 HEX 颜色。', 'error');
      return;
    }
    var css = ':root {\n' + buildPalette(hex).map(function(stop) {
      return '  --color-' + stop.name + ': ' + stop.color + ';';
    }).join('\n') + '\n}';
    copyText(css, colorStatus, '已复制整组 CSS 变量。');
  });

  document.getElementById('url-encode').addEventListener('click', function() {
    runTextTransform(urlInput, urlOutput, urlStatus, encodeURIComponent, 'URL 组件编码完成。');
  });
  document.getElementById('url-decode').addEventListener('click', function() {
    runTextTransform(urlInput, urlOutput, urlStatus, decodeURIComponent, 'URL 组件解码完成。');
  });
  document.getElementById('url-parse-query').addEventListener('click', function() {
    runTextTransform(urlInput, urlOutput, urlStatus, parseQuery, 'Query 参数解析完成。');
  });
  document.getElementById('url-build-query').addEventListener('click', function() {
    runTextTransform(urlInput, urlOutput, urlStatus, buildQuery, 'Query 参数重组完成。');
  });
  document.getElementById('url-copy').addEventListener('click', function() {
    copyText(urlOutput.value, urlStatus, '已复制转换结果。');
  });
  document.getElementById('url-clear').addEventListener('click', function() {
    urlInput.value = '';
    urlOutput.value = '';
    setStatus(urlStatus, '', '');
    urlInput.focus();
  });

  document.getElementById('base64-encode').addEventListener('click', function() {
    runTextTransform(codecInput, codecOutput, codecStatus, textToBase64, 'Base64 编码完成。');
  });
  document.getElementById('base64-decode').addEventListener('click', function() {
    runTextTransform(codecInput, codecOutput, codecStatus, base64ToText, 'Base64 解码完成。');
  });
  document.getElementById('unicode-encode').addEventListener('click', function() {
    runTextTransform(codecInput, codecOutput, codecStatus, textToUnicode, 'Unicode 转义完成。');
  });
  document.getElementById('unicode-decode').addEventListener('click', function() {
    runTextTransform(codecInput, codecOutput, codecStatus, unicodeToText, 'Unicode 还原完成。');
  });
  document.getElementById('codec-copy').addEventListener('click', function() {
    copyText(codecOutput.value, codecStatus, '已复制转换结果。');
  });
  document.getElementById('codec-clear').addEventListener('click', function() {
    codecInput.value = '';
    codecOutput.value = '';
    setStatus(codecStatus, '', '');
    codecInput.focus();
  });

  document.getElementById('sql-format').addEventListener('click', function() {
    runTextTransform(sqlInput, sqlOutput, sqlStatus, formatSql, 'SQL 格式化完成。');
  });
  document.getElementById('sql-compact').addEventListener('click', function() {
    runTextTransform(sqlInput, sqlOutput, sqlStatus, compactSql, 'SQL 压缩完成。');
  });
  document.getElementById('sql-copy').addEventListener('click', function() {
    copyText(sqlOutput.value, sqlStatus, '已复制 SQL 结果。');
  });
  document.getElementById('sql-clear').addEventListener('click', function() {
    sqlInput.value = '';
    sqlOutput.value = '';
    setStatus(sqlStatus, '', '');
    sqlInput.focus();
  });

  renderTime(Date.now());
  renderColorPalette('#0284C7');
})();
