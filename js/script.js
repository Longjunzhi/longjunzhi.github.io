(function($){
  // Search
  var $searchWrap = $('#search-form-wrap'),
    isSearchAnim = false,
    searchAnimDuration = 200;

  var startSearchAnim = function(){
    isSearchAnim = true;
  };

  var stopSearchAnim = function(callback){
    setTimeout(function(){
      isSearchAnim = false;
      callback && callback();
    }, searchAnimDuration);
  };

  $('#nav-search-btn').on('click', function(){
    if (isSearchAnim) return;

    startSearchAnim();
    $searchWrap.addClass('on');
    stopSearchAnim(function(){
      $('.search-form-input').focus();
    });
  });

  $('.search-form-input').on('blur', function(){
    startSearchAnim();
    $searchWrap.removeClass('on');
    stopSearchAnim();
  });

  // Share
  $('body').on('click', function(){
    $('.article-share-box.on').removeClass('on');
  }).on('click', '.article-share-link', function(e){
    e.stopPropagation();

    var $this = $(this),
      url = $this.attr('data-url'),
      encodedUrl = encodeURIComponent(url),
      id = 'article-share-box-' + $this.attr('data-id'),
      offset = $this.offset();

    if ($('#' + id).length){
      var box = $('#' + id);

      if (box.hasClass('on')){
        box.removeClass('on');
        return;
      }
    } else {
      var box = $('<div>', {
        id: id,
        'class': 'article-share-box'
      });
      var links = $('<div>', {'class': 'article-share-links'});

      box.append($('<input>', {
        'class': 'article-share-input',
        type: 'text'
      }).val(url));

      [
        ['https://twitter.com/intent/tweet?url=', 'article-share-twitter', 'Twitter'],
        ['https://www.facebook.com/sharer.php?u=', 'article-share-facebook', 'Facebook'],
        ['https://pinterest.com/pin/create/button/?url=', 'article-share-pinterest', 'Pinterest']
      ].forEach(function(item) {
        links.append($('<a>', {
          href: item[0] + encodedUrl,
          'class': item[1],
          target: '_blank',
          rel: 'noopener noreferrer',
          title: item[2]
        }));
      });

      box.append(links).appendTo('body');
    }

    $('.article-share-box.on').hide();

    box.css({
      top: offset.top + 25,
      left: offset.left
    }).addClass('on');
  }).on('click', '.article-share-box', function(e){
    e.stopPropagation();
  }).on('click', '.article-share-input', function(){
    $(this).select();
  }).on('click', '.article-share-box-link', function(e){
    e.preventDefault();
    e.stopPropagation();

    window.open(this.href, 'article-share-box-window-' + Date.now(), 'width=500,height=450');
  });

  // Caption and image link. Build DOM nodes directly so image metadata is never parsed as HTML.
  $('.article-entry img').each(function(){
    var image = $(this);
    var alt = this.alt || '';

    if (alt) {
      image.after($('<span>', {'class': 'caption'}).text(alt));
    }

    image.wrap($('<a>', {
      href: this.src,
      title: alt,
      'class': 'article-image-link'
    }));
  });

  // Mobile nav
  var $container = $('#container'),
    isMobileNavAnim = false,
    mobileNavAnimDuration = 200;

  var startMobileNavAnim = function(){
    isMobileNavAnim = true;
  };

  var stopMobileNavAnim = function(){
    setTimeout(function(){
      isMobileNavAnim = false;
    }, mobileNavAnimDuration);
  }

  $('#main-nav-toggle').on('click', function(){
    if (isMobileNavAnim) return;

    startMobileNavAnim();
    $container.toggleClass('mobile-nav-on');
    stopMobileNavAnim();
  });

  $('#wrap').on('click', function(){
    if (isMobileNavAnim || !$container.hasClass('mobile-nav-on')) return;

    $container.removeClass('mobile-nav-on');
  });
})(jQuery);