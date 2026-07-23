/**
 * Page & Component Animations
 *
 * Reusable animation triggers for Angular components
 *
 * @example
 * ```typescript
 * import { fadeIn, slideIn } from '@shared/animations/page-animations';
 *
 * @Component({
 *   animations: [fadeIn, slideIn]
 * })
 * ```
 */

import {
  trigger,
  state,
  style,
  transition,
  animate,
  query,
  stagger,
  keyframes,
  AnimationTriggerMetadata
} from '@angular/animations';

/**
 * Fade In Animation
 */
export const fadeIn: AnimationTriggerMetadata = trigger('fadeIn', [
  transition(':enter', [style({ opacity: 0 }), animate('300ms ease-in', style({ opacity: 1 }))])
]);

/**
 * Fade Out Animation
 */
export const fadeOut: AnimationTriggerMetadata = trigger('fadeOut', [
  transition(':leave', [animate('300ms ease-out', style({ opacity: 0 }))])
]);

/**
 * Slide In from Right
 */
export const slideInRight: AnimationTriggerMetadata = trigger('slideInRight', [
  transition(':enter', [
    style({ transform: 'translateX(100%)', opacity: 0 }),
    animate(
      '400ms cubic-bezier(0.35, 0, 0.25, 1)',
      style({ transform: 'translateX(0)', opacity: 1 })
    )
  ])
]);

/**
 * Slide In from Left
 */
export const slideInLeft: AnimationTriggerMetadata = trigger('slideInLeft', [
  transition(':enter', [
    style({ transform: 'translateX(-100%)', opacity: 0 }),
    animate(
      '400ms cubic-bezier(0.35, 0, 0.25, 1)',
      style({ transform: 'translateX(0)', opacity: 1 })
    )
  ])
]);

/**
 * Slide Up
 */
export const slideUp: AnimationTriggerMetadata = trigger('slideUp', [
  transition(':enter', [
    style({ transform: 'translateY(100%)', opacity: 0 }),
    animate(
      '400ms cubic-bezier(0.35, 0, 0.25, 1)',
      style({ transform: 'translateY(0)', opacity: 1 })
    )
  ]),
  transition(':leave', [
    animate(
      '300ms cubic-bezier(0.35, 0, 0.25, 1)',
      style({ transform: 'translateY(100%)', opacity: 0 })
    )
  ])
]);

/**
 * Scale In Animation
 */
export const scaleIn: AnimationTriggerMetadata = trigger('scaleIn', [
  transition(':enter', [
    style({ transform: 'scale(0.8)', opacity: 0 }),
    animate('300ms cubic-bezier(0.35, 0, 0.25, 1)', style({ transform: 'scale(1)', opacity: 1 }))
  ])
]);

/**
 * Route Transition (Fade)
 */
export const routeFade: AnimationTriggerMetadata = trigger('routeFade', [
  transition('* <=> *', [
    query(':enter', [style({ opacity: 0 })], { optional: true }),
    query(':leave', [animate('200ms', style({ opacity: 0 }))], { optional: true }),
    query(':enter', [animate('300ms 100ms', style({ opacity: 1 }))], { optional: true })
  ])
]);

/**
 * List Stagger Animation
 */
export const listStagger: AnimationTriggerMetadata = trigger('listStagger', [
  transition('* => *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        stagger(50, [
          animate(
            '300ms cubic-bezier(0.35, 0, 0.25, 1)',
            style({ opacity: 1, transform: 'translateY(0)' })
          )
        ])
      ],
      { optional: true }
    )
  ])
]);

/**
 * Expand/Collapse Animation
 */
export const expandCollapse: AnimationTriggerMetadata = trigger('expandCollapse', [
  state('collapsed', style({ height: '0', overflow: 'hidden', opacity: 0 })),
  state('expanded', style({ height: '*', overflow: 'visible', opacity: 1 })),
  transition('collapsed <=> expanded', animate('300ms cubic-bezier(0.35, 0, 0.25, 1)'))
]);

/**
 * Shake Animation (for errors)
 */
export const shake: AnimationTriggerMetadata = trigger('shake', [
  transition('* => shake', [
    animate(
      '400ms',
      keyframes([
        style({ transform: 'translateX(0)', offset: 0 }),
        style({ transform: 'translateX(-10px)', offset: 0.25 }),
        style({ transform: 'translateX(10px)', offset: 0.5 }),
        style({ transform: 'translateX(-10px)', offset: 0.75 }),
        style({ transform: 'translateX(0)', offset: 1 })
      ])
    )
  ])
]);

/**
 * Bounce Animation
 */
export const bounce: AnimationTriggerMetadata = trigger('bounce', [
  transition('* => bounce', [
    animate(
      '600ms',
      keyframes([
        style({ transform: 'translateY(0)', offset: 0 }),
        style({ transform: 'translateY(-20px)', offset: 0.4 }),
        style({ transform: 'translateY(0)', offset: 0.6 }),
        style({ transform: 'translateY(-10px)', offset: 0.8 }),
        style({ transform: 'translateY(0)', offset: 1 })
      ])
    )
  ])
]);

/**
 * Pulse Animation
 */
export const pulse: AnimationTriggerMetadata = trigger('pulse', [
  state('normal', style({ transform: 'scale(1)' })),
  state('pulsing', style({ transform: 'scale(1)' })),
  transition('normal => pulsing', [
    animate(
      '400ms',
      keyframes([
        style({ transform: 'scale(1)', offset: 0 }),
        style({ transform: 'scale(1.05)', offset: 0.5 }),
        style({ transform: 'scale(1)', offset: 1 })
      ])
    )
  ])
]);

/**
 * Flip Animation
 */
export const flip: AnimationTriggerMetadata = trigger('flip', [
  transition('* => flip', [
    animate(
      '600ms',
      keyframes([
        style({ transform: 'rotateY(0deg)', offset: 0 }),
        style({ transform: 'rotateY(180deg)', offset: 0.5 }),
        style({ transform: 'rotateY(360deg)', offset: 1 })
      ])
    )
  ])
]);

/**
 * Modal/Dialog Animation
 */
export const modalAnimation: AnimationTriggerMetadata = trigger('modalAnimation', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.9) translateY(-20px)' }),
    animate(
      '300ms cubic-bezier(0.35, 0, 0.25, 1)',
      style({ opacity: 1, transform: 'scale(1) translateY(0)' })
    )
  ]),
  transition(':leave', [
    animate(
      '200ms cubic-bezier(0.35, 0, 0.25, 1)',
      style({ opacity: 0, transform: 'scale(0.9) translateY(-20px)' })
    )
  ])
]);

/**
 * Slide Toggle Animation
 */
export const slideToggle: AnimationTriggerMetadata = trigger('slideToggle', [
  state('void', style({ height: '0', overflow: 'hidden' })),
  state('*', style({ height: '*', overflow: 'visible' })),
  transition('void <=> *', animate('300ms cubic-bezier(0.35, 0, 0.25, 1)'))
]);

/**
 * Rotate Animation
 */
export const rotate: AnimationTriggerMetadata = trigger('rotate', [
  state('normal', style({ transform: 'rotate(0deg)' })),
  state('rotated', style({ transform: 'rotate(180deg)' })),
  transition('normal <=> rotated', animate('300ms cubic-bezier(0.35, 0, 0.25, 1)'))
]);
