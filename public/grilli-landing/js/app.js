/*
    SLIDE
*/
const heroSliderItems = document.querySelectorAll(".slider-item");
const heroSliderPrevBtn = document.querySelector(".slider-prev");
const heroSliderNextBtn = document.querySelector(".slider-next");

let currentSlidePos = 0;
let lastActiveSliderItem = heroSliderItems[0];

const updateSlider = function () {
    lastActiveSliderItem.classList.remove("slider-item--active");
    heroSliderItems[currentSlidePos].classList.add("slider-item--active");
    lastActiveSliderItem = heroSliderItems[currentSlidePos];
}

const slideNext = function () {
    if (currentSlidePos >= heroSliderItems.length - 1) {
        currentSlidePos = 0;
    } else {
        currentSlidePos++;
    }

    updateSlider();
}

heroSliderNextBtn.addEventListener("click", slideNext);

const slidePrev = function () {
    if (currentSlidePos <= 0) {
        currentSlidePos = heroSliderItems.length - 1;
    } else {
        currentSlidePos--;
    }

    updateSlider();
}

heroSliderPrevBtn.addEventListener("click", slidePrev);


/* Autoslide */
let autoSlideInterval;

const autoSlide = function () {
    autoSlideInterval = setInterval(function () {
        slideNext();
    }, 8000);
}

const addEventOnElements = function (elements, eventType, callback) {
    for (let i = 0, len = elements.length; i < len; i++) {
        elements[i].addEventListener(eventType, callback);
    }
}

addEventOnElements([heroSliderNextBtn, heroSliderPrevBtn], "mouseover", function () {
    clearInterval(autoSlideInterval);
});

addEventOnElements([heroSliderNextBtn, heroSliderPrevBtn], "mouseout", autoSlide);



/*
    ASIDE
*/
const aside = document.querySelector('aside');
const asideOverlay = document.querySelector('.aside-overlay');
const asideClose = document.querySelector('.aside-close');
const asideOpen = document.querySelector('.aside-open');
const navItems = document.querySelector('aside .nav__items');

asideOpen.addEventListener('click', () => {
    aside.classList.add('aside--show');
    asideOverlay.classList.add('aside--show');
})

asideClose.addEventListener('click', () => {
    aside.classList.remove('aside--show');
    asideOverlay.classList.remove('aside--show');
})

navItems.addEventListener('click', (e) => {
    if (e.target.matches('a')) {
        aside.classList.remove('aside--show');
        asideOverlay.classList.remove('aside--show');
    }
})

/*
    LOADED
*/
const preload = document.querySelector('.preload');

addEventListener('load', () => {
    setTimeout(() => {
        preload.classList.add('loaded');
        document.body.classList.add('loaded');
        // scroll(0, 0);
    }, 100)

    setTimeout(() => {
        heroSliderItems[0].classList.add('slider-item--active');
        autoSlide();
    }, 200)
})


/*
    HEADER & BACK TOP
*/
const nav = document.querySelector('nav');
const backTop = document.querySelector('.back-top');

let lastScrollPos = 0;

const hideNav = function () {
    lastScrollPos < scrollY ? nav.classList.add('hide') : nav.classList.remove('hide');
    lastScrollPos = scrollY;
}

addEventListener('scroll', function () {
    if (window.scrollY >= 200) {
        nav.classList.add('scrolled');
        backTop.classList.add('scrolled');
        hideNav();
    } else {
        nav.classList.remove('scrolled');
        backTop.classList.remove('scrolled');
    }
});

backTop.addEventListener('click', () => {
    scroll(0,0)
})


/*
    MENU
*/
let menu = [
    {
        dish: 'Chicken Dum Biryani',
        tag: 'Must Try',
        price: '300',
        description: 'Authentic Hyderabadi style slow-cooked chicken dum biryani, layered with premium long-grain basmati rice and spices.',
    },
    {
        dish: 'Mutton Dum Biryani',
        tag: 'Chef Special',
        price: '420',
        description: 'Tender, juicy mutton pieces slow-cooked with basmati rice in traditional dum style.',
    },
    {
        dish: 'Sai Silver SP Chicken Biryani',
        tag: 'Signature',
        price: '350',
        description: 'Our signature special chicken biryani, prepared with select spices and fresh ingredients for a royal taste.',
    },
    {
        dish: 'Chicken Lollypop',
        tag: 'Popular',
        price: '250',
        description: 'Crispy and juicy chicken wings shaped like lollipops, tossed in a hot and spicy sauce.',
    },
    {
        dish: 'Butter Naan with Gravy',
        tag: 'Popular',
        price: '150',
        description: 'Soft, fluffy butter naan freshly baked in tandoor, served with our signature rich and creamy masala gravy.',
    },
    {
        dish: 'Kaju Chicken Biryani',
        tag: 'Rich',
        price: '320',
        description: 'Delectable biryani cooked with tender chicken pieces, premium roasted cashew nuts, and select spices.',
    },
]

menu.forEach((item, index) => {
    let div = document.createElement('div');
    div.classList.add('menu-item');
    div.setAttribute('title', item.dish);
    document.querySelector('.menu-box').appendChild(div);

    div.innerHTML = `
        <img src="./img/menu-${index+1}.png" alt="Dish">
        <div class="menu__info">
            <div class="menu__info-top">
                <h2>${item.dish}</h2>
                <span></span>
                <h3>₹${item.price}</h3>
            </div>
            <p>${item.description}</p>
        </div>
    `;

    if (item.tag != '') {
        let tag = document.createElement('div');
        tag.textContent = item.tag;
        tag.classList.add('tag');
        div.children[1].children[0].children[0].insertAdjacentElement('afterend', tag);
    }
})



/*
    ONLINE RESERVATION
*/
const inputDate = document.getElementById('reservation-date');

addEventListener('load', () => {
    let now = new Date();
    let currentTime = now.toISOString().substring(0, 10);
    inputDate.value = currentTime;
    inputDate.setAttribute('min', currentTime);
})