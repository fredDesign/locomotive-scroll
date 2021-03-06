// ==========================================================================
// Locomotive Smooth Scroll
// ==========================================================================
/* jshint esnext: true */
import { $window, $document, $html, APP_NAME } from '../utils/environment';
import Scroll, { Defaults } from './Scroll';

import debounce from '../utils/debounce';
import Scrollbar from 'smooth-scrollbar';
import { isNumeric } from '../utils/is';

const DATA_KEY  = `${APP_NAME}.Scrolling`;
const EVENT_KEY = `.${DATA_KEY}`;

const Event = {
    CLICK: `click${EVENT_KEY}`,
    ISREADY: `isReady${EVENT_KEY}`,
    REBUILD: `rebuild${EVENT_KEY}`,
    RENDER: `render${EVENT_KEY}`,
    RESIZE: `resize${EVENT_KEY}`,
    SCROLL: `scroll${EVENT_KEY}`,
    SCROLLTO: `scrollTo${EVENT_KEY}`,
    UPDATE: `update${EVENT_KEY}`
};

/**
 * Smooth scrolling using `smooth-scrollbar`.
 * Based on `Scroll` class, which allows animations of elements on the page
 * according to scroll position.
 *
 * @todo  Method to get the distance (as percentage) of an element in the viewport
 */
export default class extends Scroll {
    constructor(options) {
        super(options);

        this.isReversed = options.reversed || Defaults.reversed;
        this.parallaxElements = [];
    }

    /**
     * Initialize scrolling animations
     */
    init() {
        // Add class to the document to know if SmoothScroll is initialized (to manage overflow on containers)
        $html.addClass('has-smooth-scroll');

        this.scrollbar = Scrollbar.init(this.$container[0],{
            syncCallbacks: true
        });

        this.scrollbarStatus = undefined;

        this.setScrollbarLimit();

        this.setWheelDirection(this.isReversed);

        this.addElements();

        this.renderAnimations(true);

        // On scroll
        this.scrollbar.addListener((status) => this.renderAnimations(false, status));

        // Rebuild event
        this.$container.on(Event.REBUILD, () => {
            this.scrollbar.scrollTo(0, 0, 0);
            this.updateElements();
        });

        // Update event
        this.$container.on(Event.UPDATE, (event, options) => this.updateElements(options));

        // Render event
        this.$container.on(Event.RENDER, () => this.renderAnimations(false));

        // Scrollto button event
        this.$container.on(Event.CLICK, '.js-scrollto', (event) => {
            event.preventDefault();
            this.scrollTo({
                sourceElem: $(event.currentTarget)
            });
        });
        this.$container.on(Event.SCROLLTO, (event) => this.scrollTo(event.options));

        // Setup done
        $document.triggerHandler({
            type: Event.ISREADY
        });

        // Resize event
        $window.on(Event.RESIZE, debounce(() => {
            this.updateElements()
        }, 20));
    }

    /**
     * Reset existing elements and find all animatable elements.
     * Called on page load and any subsequent updates.
     */
    addElements() {
        this.animatedElements = [];
        this.parallaxElements = [];

        const $elements = $(this.selector);
        const len = $elements.length;
        let i = 0;

        for (; i < len; i ++) {
            let $element = $elements.eq(i);
            let elementSpeed = isNumeric($element.data('speed')) ? parseInt($element.data('speed')) / 10 : false
            let elementPosition = $element.data('position');
            let elementTarget = $element.data('target');
            let elementHorizontal = $element.data('horizontal');
            let elementSticky = (typeof $element.data('sticky') === 'string');
            let elementStickyTarget = $element.data('sticky-target');
            let $target = (elementTarget) ? $(elementTarget) : $element;
            let elementOffset = $target.offset().top + this.scrollbar.scrollTop;
            let elementLimit = elementOffset + $target.outerHeight();

            //Manage callback
            let elementCallbackString = (typeof $element.data('callback') === 'string') ? $element.data('callback') : null;
            let elementCallback = null;

            if(elementCallbackString != null){
                let event = elementCallbackString.substr(0, elementCallbackString.indexOf(':'));
                let optionsString = elementCallbackString.substr(elementCallbackString.indexOf('{'),elementCallbackString.length - event.length);
                optionsString = optionsString.replace(/([a-z][^:]*)(?=\s*:)/g, '"$1"');
                let options = JSON.parse(optionsString.toString());
                elementCallback = {event:event, options:options};
            }

            // If elements stays visible after scrolling past it
            let elementRepeat = (typeof $element.data('repeat') === 'string');

            let elementInViewClass = $element.data('inview-class');
            if (typeof elementInViewClass === 'undefined') {
                elementInViewClass = 'is-show';
            }

            if (!elementTarget && $element.data('transform')) {
                elementOffset -= parseFloat($element.data('transform').y);
            }

            if (elementSticky) {
                if (typeof elementStickyTarget === 'undefined') {
                    elementLimit = $('.scroll-content').height();
                } else {
                    elementLimit = $(elementStickyTarget).offset().top - $element.height() + this.scrollbar.scrollTop;
                }
            }

            const newElement = {
                $element: $element,
                inViewClass: elementInViewClass,
                limit: elementLimit,
                offset: Math.round(elementOffset),
                repeat: elementRepeat,
                callback: elementCallback
            };

            // For parallax animated elements
            if (elementSpeed !== false) {
                let elementPosition = $element.data('position');
                let elementHorizontal = $element.data('horizontal');
                let elementMiddle = ((elementLimit - elementOffset) / 2) + elementOffset;

                newElement.horizontal = elementHorizontal;
                newElement.middle = elementMiddle;
                newElement.offset = elementOffset;
                newElement.position = elementPosition;
                newElement.speed = elementSpeed

                this.parallaxElements.push(newElement);
            } else {
                newElement.sticky = elementSticky;

                this.animatedElements.push(newElement);

                // @todo Useful?
                // Don't add element if it already has its in view class and doesn't repeat
                // if (elementRepeat || !$element.hasClass(elementInViewClass)) {
                //     this.animatedElements.push(newElement);
                // }

                if (elementSticky) {
                    //launch the toggle function to set the position of the sticky element
                    this.toggleElement(newElement);
                }
            }
        };
    }

    /**
     * Render the class/transform animations, and update the global scroll positionning.
     *
     * @param  {boolean} isFirstCall Determines if this is the first occurence of method being called
     * @param  {object}  status      Optional status object received when method is
     *                               called by smooth-scrollbar instance listener.
     * @return {void}
     */
    renderAnimations(isFirstCall, status) {
        if (typeof status === 'object') {
            this.scrollbarStatus = status;
        }

        const scrollbarTop = this.scrollbar.scrollTop;

        // if (scrollbarTop > this.scroll.y) {
        //     if (this.scroll.direction !== 'down') {
        //         this.scroll.direction = 'down';
        //     }
        // } else if (scrollbarTop < this.scroll.y) {
        //     if (this.scroll.direction !== 'up') {
        //         this.scroll.direction = 'up';
        //     }
        // }

        if (this.scroll.y !== scrollbarTop) {
            this.scroll.y = scrollbarTop;
        }

        this.transformElements(isFirstCall);
        this.animateElements();
    }

    /**
     * Scroll to a desired target.
     *
     * @param  {object} options
     * @return {void}
     */
    scrollTo(options) {
        const $targetElem = options.targetElem;
        const $sourceElem = options.sourceElem;
        let targetOffset = isNumeric(options.targetOffset) ? parseInt(options.targetOffset) : 0;
        const delay = isNumeric(options.delay) ? parseInt(options.delay) : 0;
        const speed = isNumeric(options.speed) ? parseInt(options.speed) : 800;
        const toTop = options.toTop;
        const toBottom = options.toBottom;

        if (typeof $targetElem === 'undefined' && typeof $sourceElem === 'undefined' && typeof targetOffset === 'undefined') {
            console.warn('You must specify at least one parameter.')
            return false;
        }

        if (typeof $targetElem !== 'undefined' && $targetElem instanceof jQuery && $targetElem.length > 0) {
            targetOffset = $targetElem.offset().top + this.scrollbar.scrollTop + targetOffset;
        }

        if (typeof $sourceElem !== 'undefined' && $sourceElem instanceof jQuery && $sourceElem.length > 0) {
            let targetData = '';

            if ($sourceElem.data('target')) {
                targetData = $sourceElem.data('target');
            } else {
                targetData = $sourceElem.attr('href');
            }

            targetOffset = $(targetData).offset().top + this.scrollbar.scrollTop + targetOffset;
        }

        if (toTop === true) {
            targetOffset = 0;
        } else if (toBottom === true) {
            targetOffset = this.scrollbar.limit.y;
        }

        setTimeout(() => {
            this.scrollbar.scrollTo(0, targetOffset, speed);
        }, delay);
    }

    /**
     * Set the scroll bar limit
     */
    setScrollbarLimit() {
        this.scrollbarLimit = this.scrollbar.limit.y + this.windowHeight;
    }

    /**
     * Apply CSS transform properties on an element.
     *
     * @param  {object}  $element Targetted jQuery element
     * @param  {int}     x        Translate value
     * @param  {int}     y        Translate value
     * @param  {int}     z        Translate value
     * @return {void}
     */
    transformElement($element, x, y, z) {
        // Defaults
        x = x || 0;
        y = y || 0;
        z = z || 0;

        // Translate and store the positionning as `data`
        $element.css({
            '-webkit-transform': `translate3d(${x}px, ${y}px, ${z}px)`,
            '-ms-transform': `translate3d(${x}px, ${y}px, ${z}px)`,
            'transform': `translate3d(${x}px, ${y}px, ${z}px)`
        }).data('transform',{
            x : x,
            y : y,
            z : z
        });

        // Affect child elements with the same positionning
        const children = $element.find(this.selector);
        const len = children.length;
        let i = 0;
        for (; i < len; i++) {
            let $child = $(children[i]);
            if (!$child.data('transform')) {
                $child.data('transform', {
                    x: x,
                    y: y,
                    z: z
                })
            }
        };
    }

    /**
     * Loop through all parallax-able elements and apply transform method(s).
     *
     * @param  {boolean} isFirstCall Determines if this is the first occurence of method being called
     * @return {void}
     */
    transformElements(isFirstCall) {
        if (this.parallaxElements.length > 0) {
            const scrollbarBottom = this.scrollbar.scrollTop + this.windowHeight;
            const scrollbarMiddle = this.scrollbar.scrollTop + this.windowMiddle;

            let i = 0;
            const len = this.parallaxElements.length;
            const removeIndexes = [];

            for (; i < len; i++) {
                let curEl = this.parallaxElements[i];
                // Old
                let scrollBottom = scrollbarBottom;
                // New
                // let scrollBottom = (curEl.position === 'top') ? this.scrollbar.scrollTop : scrollbarBottom;

                let transformDistance = false;

                // Define if the element is in view
                // Old
                let inView = (scrollBottom >= curEl.offset && this.scroll.y <= curEl.limit);
                // New
                // let inView = (scrollBottom >= curEl.offset && this.scrollbar.scrollTop <= curEl.limit);

                this.toggleElement(curEl, i);

                if (isFirstCall && !inView && curEl.speed) {
                    // Different calculations if it is the first call and the item is not in the view
                    if (curEl.position !== 'top') {
                        transformDistance = (curEl.offset - this.windowMiddle - curEl.middle) * -curEl.speed;
                    }
                }

                // If element is in view
                if (inView && curEl.speed) {
                    switch (curEl.position) {
                        case 'top':
                            // Old
                            transformDistance = this.scrollbar.scrollTop * -curEl.speed;
                            // New
                            // transformDistance = (this.scrollbar.scrollTop - curEl.offset) * -curEl.speed;
                        break;

                        case 'bottom':
                            transformDistance = (this.scrollbarLimit - scrollBottom) * curEl.speed;
                        break;

                        default:
                            transformDistance = (scrollbarMiddle - curEl.middle) * -curEl.speed;
                        break;
                    }
                }

                // Transform horizontal OR vertical. Defaults to vertical
                if (isNumeric(transformDistance)) {
                    (curEl.horizontal) ?
                        this.transformElement(curEl.$element, transformDistance) :
                        this.transformElement(curEl.$element, 0, transformDistance);
                }
            }
        }
    }

    /**
     * Update elements and recalculate all the positions on the page
     *
     * @param {object} options
     */
    updateElements(options) {
        options = options || {};

        this.scrollbar.update();
        this.windowHeight = $window.height();
        this.windowMiddle = this.windowHeight / 2;
        this.setScrollbarLimit();
        this.setWheelDirection(this.isReversed);
        this.addElements();
        this.transformElements(true);

        if (typeof options.callback === 'function') {
            options.callback();
        }
    }

    /**
     * Set smooth-scrollbar scrolling direction for wheel event
     * @param {Boolean} isReversed
     */
    setWheelDirection(isReversed){
        this.scrollbar.reverseWheel(isReversed);
    }

    /**
     * Destroy
     */
    destroy() {
        super.destroy();
        $html.removeClass('has-smooth-scroll');
        this.parallaxElements = [];
        this.scrollbar.destroy();
    }
}
