(function() {
  'use strict';

  var dataInput = document.getElementById('data-input');
  if (!dataInput) return;

  var dataOutput = document.getElementById('data-output');
  var dataStatus = document.getElementById('data-status');
  var timestampInput = document.getElementById('timestamp-input');
  var datetimeInput = document.getElementById('datetime-input');
  var timeStatus = document.getElementById('time-status');
  var parseTimer;

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

  function renderData(compact) {
    try {
      var parsed = parseData(dataInput.value);
      dataOutput.value = JSON.stringify(parsed.value, null, compact ? 0 : 2);
      setStatus(dataStatus, '已识别为' + parsed.type + '，格式化成功。', 'success');
    } catch (error) {
      dataOutput.value = '';
      setStatus(dataStatus, error.message, 'error');
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

  document.getElementById('format-data').addEventListener('click', function() { renderData(false); });
  document.getElementById('compact-data').addEventListener('click', function() { renderData(true); });
  document.getElementById('copy-data').addEventListener('click', function() {
    copyText(dataOutput.value, dataStatus, '已复制格式化结果。');
  });
  document.getElementById('clear-data').addEventListener('click', function() {
    dataInput.value = '';
    dataOutput.value = '';
    setStatus(dataStatus, '', '');
    dataInput.focus();
  });
  dataInput.addEventListener('input', function() {
    window.clearTimeout(parseTimer);
    parseTimer = window.setTimeout(function() {
      if (dataInput.value.trim()) renderData(false);
      else {
        dataOutput.value = '';
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

  renderTime(Date.now());
})();
