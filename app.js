(() => {
            const tooltip = document.getElementById('custom-button-tooltip');
            let activeButton = null;
            let pendingHideTimer = 0;
            const captureTitle = element => {
                if (!(element instanceof HTMLElement)) return;
                const title = element.getAttribute('title');
                if (title === null) return;
                if (title) element.dataset.customTooltip = title;
                else delete element.dataset.customTooltip;
                element.removeAttribute('title');
            };
            const captureTitlesWithin = node => {
                if (!(node instanceof Element)) return;
                if (node.hasAttribute('title')) captureTitle(node);
                node.querySelectorAll('[title]').forEach(captureTitle);
            };
            const positionTooltip = () => {
                if (!activeButton?.isConnected) return hideTooltip();
                const rect = activeButton.getBoundingClientRect();
                const halfWidth = tooltip.offsetWidth / 2;
                const x = Math.max(8 + halfWidth, Math.min(innerWidth - 8 - halfWidth, rect.left + rect.width / 2));
                tooltip.style.left = `${x}px`;
                const belowTop = rect.bottom + 8;
                const fitsBelow = belowTop + tooltip.offsetHeight <= innerHeight - 8;
                tooltip.style.top = `${fitsBelow ? belowTop : rect.top - tooltip.offsetHeight - 8}px`;
            };
            const hideTooltip = () => {
                if (!activeButton) return;
                const currentStyle = getComputedStyle(tooltip);
                tooltip.style.setProperty('--tooltip-exit-start-opacity', currentStyle.opacity);
                tooltip.style.setProperty('--tooltip-exit-start-transform', currentStyle.transform);
                activeButton = null;
                tooltip.classList.remove('visible', 'switching');
                tooltip.classList.add('hiding');
                tooltip.setAttribute('aria-hidden', 'true');
            };
            const showTooltip = button => {
                if (button.dataset.tooltipSuppressed === 'true') return hideTooltip();
                if (document.body.classList.contains('resizing-active')) return hideTooltip();
                const text = button.dataset.customTooltip;
                if (!text) return hideTooltip();
                if (activeButton === button && tooltip.textContent === text) return;
                const morph = tooltip.classList.contains('visible') || tooltip.classList.contains('hiding');
                const previousRect = morph ? tooltip.getBoundingClientRect() : null;
                activeButton = button;
                tooltip.textContent = text;
                tooltip.setAttribute('aria-hidden', 'false');
                tooltip.classList.remove('switching', 'hiding');
                positionTooltip();
                const buttonRect = button.getBoundingClientRect();
                const tooltipCenterX = parseFloat(tooltip.style.left);
                const tooltipCenterY = parseFloat(tooltip.style.top) + tooltip.offsetHeight / 2;
                tooltip.style.setProperty('--tooltip-entry-dx', `${buttonRect.left + buttonRect.width / 2 - tooltipCenterX}px`);
                tooltip.style.setProperty('--tooltip-entry-dy', `${buttonRect.top + buttonRect.height / 2 - tooltipCenterY}px`);
                if (morph && previousRect) {
                    tooltip.classList.add('visible');
                    const nextCenterX = parseFloat(tooltip.style.left);
                    const nextCenterY = parseFloat(tooltip.style.top) + tooltip.offsetHeight / 2;
                    tooltip.style.setProperty('--tooltip-dx', `${previousRect.left + previousRect.width / 2 - nextCenterX}px`);
                    tooltip.style.setProperty('--tooltip-dy', `${previousRect.top + previousRect.height / 2 - nextCenterY}px`);
                    void tooltip.offsetWidth;
                    tooltip.classList.add('switching');
                } else {
                    tooltip.classList.add('visible');
                }
            };
            tooltip.addEventListener('animationend', event => {
                if (event.animationName === 'custom-tooltip-exit') tooltip.classList.remove('hiding');
            });
            document.querySelectorAll('[title]').forEach(captureTitle);
            new MutationObserver(records => {
                for (const record of records) {
                    if (record.target === document.body && document.body.classList.contains('resizing-active')) {
                        hideTooltip();
                        continue;
                    }
                    if (record.type === 'attributes') {
                        if (record.target.hasAttribute('title')) captureTitle(record.target);
                        if (record.target === activeButton && activeButton.dataset.customTooltip && tooltip.textContent !== activeButton.dataset.customTooltip) {
                            tooltip.textContent = activeButton.dataset.customTooltip;
                        }
                    } else {
                        record.addedNodes.forEach(captureTitlesWithin);
                    }
                }
                if (activeButton && !activeButton.dataset.customTooltip) hideTooltip();
            }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['title', 'class'] });
            document.addEventListener('pointerover', event => {
                const button = event.target.closest?.('[data-custom-tooltip]');
                if (button && button !== event.relatedTarget?.closest?.('[data-custom-tooltip]')) {
                    if (pendingHideTimer) clearTimeout(pendingHideTimer);
                    pendingHideTimer = 0;
                    showTooltip(button);
                }
            });
            document.addEventListener('pointerout', event => {
                const button = event.target.closest?.('[data-custom-tooltip]');
                if (button?.dataset.tooltipSuppressed === 'true' && button.id === 'delete-audio-trigger' && !button.contains(event.relatedTarget) && document.getElementById('audio-delete-confirmation')?.classList.contains('hidden')) {
                    delete button.dataset.tooltipSuppressed;
                }
                if (button && button !== event.relatedTarget?.closest?.('[data-custom-tooltip]') && activeButton === button) {
                    pendingHideTimer = setTimeout(() => {
                        pendingHideTimer = 0;
                        if (activeButton === button) hideTooltip();
                    }, 60);
                }
            });
            document.addEventListener('focusin', event => {
                const button = event.target.closest?.('[data-custom-tooltip]');
                if (button) showTooltip(button);
            });
            document.addEventListener('focusout', event => {
                if (activeButton && event.target === activeButton) hideTooltip();
            });
            window.addEventListener('resize', positionTooltip);
            window.addEventListener('scroll', positionTooltip, true);
        })();

        // Encabezados del panel de letras: se insertan sin reordenar sus controles.
        {
            const makeLyricsSectionTitle = text => {
                const title = document.createElement('h3');
                title.className = 'settings-group-title lyrics-settings-title';
                title.textContent = text;
                return title;
            };
            document.getElementById('lyrics-color-controls')?.before(makeLyricsSectionTitle('Relleno'));
            document.getElementById('lyrics-shadow-light-controls')?.before(makeLyricsSectionTitle('Efecto'));
        }

        // Scrollbars propias para todos los elementos desplazables de la interfaz.
        (() => {
            const entries = new Map();
            const minThumb = 24;
            const isScrollable = (el, axis) => {
                const style = getComputedStyle(el);
                const overflow = axis === 'y' ? style.overflowY : style.overflowX;
                return (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') &&
                    (axis === 'y' ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1);
            };
            const makeBar = (el, axis) => {
                const bar = document.createElement('div');
                const thumb = document.createElement('div');
                bar.className = `winui-scrollbar ${axis === 'y' ? 'vertical' : 'horizontal'}`;
                if (axis === 'y' && el.id === 'lyrics-editor-panel') bar.classList.add('lyrics-editor-scrollbar');
                bar.setAttribute('aria-hidden', 'true');
                thumb.className = 'winui-scrollbar-thumb';
                bar.append(thumb);
                document.body.append(bar);
                let drag = null;
                let pendingScroll = null;
                let scrollAnimationFrame = 0;
                const pointerValue = event => axis === 'y' ? event.clientY : event.clientX;
                const currentScroll = () => axis === 'y' ? el.scrollTop : el.scrollLeft;
                const setScroll = value => {
                    if (axis === 'y') el.scrollTop = value;
                    else el.scrollLeft = value;
                };
                const scrollMetrics = () => {
                    const barRect = bar.getBoundingClientRect();
                    const thumbRect = thumb.getBoundingClientRect();
                    const trackStart = axis === 'y' ? barRect.top : barRect.left;
                    const trackLength = axis === 'y' ? barRect.height : barRect.width;
                    const thumbLength = axis === 'y' ? thumbRect.height : thumbRect.width;
                    const scrollRange = axis === 'y'
                        ? el.scrollHeight - el.clientHeight
                        : el.scrollWidth - el.clientWidth;
                    return { trackStart, travel: Math.max(0, trackLength - thumbLength), scrollRange };
                };
                const scrollForPointer = pointer => {
                    const { trackStart, travel, scrollRange } = scrollMetrics();
                    if (travel < 1 || scrollRange < 1) return null;
                    const thumbLength = axis === 'y' ? thumb.offsetHeight : thumb.offsetWidth;
                    const offset = Math.max(0, Math.min(travel, pointer - trackStart - thumbLength / 2));
                    return offset / travel * scrollRange;
                };
                const detachPendingListeners = pending => {
                    if (!pending.listenersAttached) return;
                    window.removeEventListener('pointermove', pending.onMove);
                    window.removeEventListener('pointerup', pending.onUp);
                    window.removeEventListener('pointercancel', pending.onUp);
                    pending.listenersAttached = false;
                };
                const cancelSmoothScroll = () => {
                    if (scrollAnimationFrame) cancelAnimationFrame(scrollAnimationFrame);
                    scrollAnimationFrame = 0;
                    if (pendingScroll) {
                        pendingScroll.cancelled = true;
                        detachPendingListeners(pendingScroll);
                        pendingScroll = null;
                    }
                };
                const pointerMove = event => {
                    if (!drag || event.pointerId !== drag.pointerId) return;
                    const nextScroll = drag.startScroll + (pointerValue(event) - drag.startPointer) * drag.scrollPerPixel;
                    setScroll(nextScroll);
                };
                const pointerUp = event => {
                    if (!drag || event.pointerId !== drag.pointerId) return;
                    drag = null;
                    bar.classList.remove('dragging');
                    window.removeEventListener('pointermove', pointerMove);
                    window.removeEventListener('pointerup', pointerUp);
                    window.removeEventListener('pointercancel', pointerUp);
                };
                const beginDrag = (pointer, pointerId) => {
                    const { travel, scrollRange } = scrollMetrics();
                    if (travel < 1 || scrollRange < 1) return;
                    drag = {
                        pointerId,
                        startPointer: pointer,
                        startScroll: currentScroll(),
                        scrollPerPixel: scrollRange / travel
                    };
                    bar.classList.add('dragging');
                    window.addEventListener('pointermove', pointerMove);
                    window.addEventListener('pointerup', pointerUp);
                    window.addEventListener('pointercancel', pointerUp);
                };
                const smoothScrollToPointer = event => {
                    event.preventDefault();
                    cancelSmoothScroll();
                    const pending = {
                        pointer: pointerValue(event),
                        pointerId: event.pointerId,
                        held: true,
                        cancelled: false,
                        listenersAttached: true
                    };
                    pending.onMove = moveEvent => {
                        if (moveEvent.pointerId === pending.pointerId) pending.pointer = pointerValue(moveEvent);
                    };
                    pending.onUp = upEvent => {
                        if (upEvent.pointerId !== pending.pointerId) return;
                        pending.pointer = pointerValue(upEvent);
                        pending.held = false;
                        detachPendingListeners(pending);
                    };
                    window.addEventListener('pointermove', pending.onMove);
                    window.addEventListener('pointerup', pending.onUp);
                    window.addEventListener('pointercancel', pending.onUp);
                    pendingScroll = pending;

                    const targetScroll = scrollForPointer(pending.pointer);
                    if (targetScroll === null) {
                        cancelSmoothScroll();
                        return;
                    }
                    const startScroll = currentScroll();
                    if (Math.abs(targetScroll - startScroll) < 1) {
                        detachPendingListeners(pending);
                        pendingScroll = null;
                        beginDrag(pending.pointer, pending.pointerId);
                        return;
                    }
                    const startTime = performance.now();
                    const duration = 300;
                    const animate = now => {
                        if (pending.cancelled) return;
                        const progress = Math.min(1, (now - startTime) / duration);
                        const eased = 1 - Math.pow(1 - progress, 3);
                        const target = scrollForPointer(pending.pointer);
                        if (target !== null) setScroll(startScroll + (target - startScroll) * eased);
                        if (progress < 1) {
                            scrollAnimationFrame = requestAnimationFrame(animate);
                            return;
                        }
                        scrollAnimationFrame = 0;
                        if (target !== null) setScroll(target);
                        detachPendingListeners(pending);
                        if (pendingScroll === pending) pendingScroll = null;
                        if (pending.held && !pending.cancelled) beginDrag(pending.pointer, pending.pointerId);
                    };
                    scrollAnimationFrame = requestAnimationFrame(animate);
                };
                const startDrag = event => {
                    event.preventDefault();
                    cancelSmoothScroll();
                    beginDrag(pointerValue(event), event.pointerId);
                };
                thumb.addEventListener('pointerdown', startDrag);
                bar.addEventListener('pointerdown', event => {
                    if (event.target === thumb) return;
                    if (axis === 'y' && bar.classList.contains('lyrics-editor-scrollbar')) {
                        const rect = bar.getBoundingClientRect();
                        const thumbRect = thumb.getBoundingClientRect();
                        const edgeHit = bar.classList.contains('edge-left')
                            ? event.clientX <= rect.left + 8
                            : event.clientX >= rect.right - 8;
                        const thumbHitY = event.clientY >= thumbRect.top && event.clientY <= thumbRect.bottom;
                        if (edgeHit && thumbHitY) {
                            startDrag(event);
                        } else smoothScrollToPointer(event);
                        return;
                    }
                    const thumbRect = thumb.getBoundingClientRect();
                    const pointer = pointerValue(event);
                    const thumbStart = axis === 'y' ? thumbRect.top : thumbRect.left;
                    const thumbEnd = axis === 'y' ? thumbRect.bottom : thumbRect.right;
                    if (pointer >= thumbStart && pointer <= thumbEnd) startDrag(event);
                    else smoothScrollToPointer(event);
                });
                return { bar, thumb, axis };
            };
            const syncEntry = (el, entry) => {
                const rect = el.getBoundingClientRect();
                const visible = rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
                for (const item of entry.bars) {
                    const { bar, thumb, axis } = item;
                    const active = visible && isScrollable(el, axis);
                    bar.classList.toggle('visible', active);
                    if (!active) continue;
                    if (axis === 'y') {
                        const leftSide = el.classList.contains('left-scrollbar');
                        if (el.id === 'lyrics-editor-panel') {
                            bar.style.left = leftSide ? `${rect.left}px` : `${rect.right - 22}px`;
                            bar.classList.toggle('edge-left', leftSide);
                        } else {
                            bar.style.left = leftSide ? `${rect.left + 8}px` : `${rect.right - 22}px`;
                        }
                        const headerBottom = el.classList.contains('settings-drawer')
                            ? el.querySelector('.settings-back-button')?.getBoundingClientRect().bottom
                            : null;
                        const trackTop = headerBottom ? Math.max(rect.top + 10, headerBottom + 10) : rect.top + 10;
                        const trackBottom = rect.bottom - 10;
                        const trackLength = Math.max(1, trackBottom - trackTop);
                        bar.style.top = `${trackTop}px`;
                        bar.style.height = `${trackLength}px`;
                        const thumbSize = Math.max(minThumb, trackLength * el.clientHeight / el.scrollHeight);
                        const travel = Math.max(0, trackLength - thumbSize);
                        const offset = Math.round(travel * el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight));
                        thumb.style.height = `${thumbSize}px`;
                        thumb.style.transform = `translateY(${offset}px)`;
                    } else {
                        const trackLength = Math.max(1, rect.width);
                        bar.style.left = `${rect.left}px`;
                        bar.style.top = `${rect.bottom - 14}px`;
                        bar.style.width = `${trackLength}px`;
                        const thumbSize = Math.max(minThumb, trackLength * el.clientWidth / el.scrollWidth);
                        const travel = Math.max(0, trackLength - thumbSize);
                        const offset = Math.round(travel * el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth));
                        thumb.style.width = `${thumbSize}px`;
                        thumb.style.transform = `translateX(${offset}px)`;
                    }
                }
            };
            const refresh = () => {
                [document.documentElement, document.body, ...document.body.querySelectorAll('*')].forEach(el => {
                    if (!(el instanceof HTMLElement) || el.classList.contains('winui-scrollbar')) return;
                    const scrollable = isScrollable(el, 'y') || isScrollable(el, 'x');
                    if (!scrollable) return;
                    el.classList.add('winui-scroll-host');
                    if (!entries.has(el)) {
                        const entry = { bars: [], onScroll: null, axes: new Set() };
                        entry.onScroll = () => {
                            syncEntry(el, entry);
                            if (el.classList.contains('settings-drawer')) el.classList.toggle('is-scrolled', el.scrollTop > 0.5);
                        };
                        el.addEventListener('scroll', entry.onScroll, { passive: true });
                        entries.set(el, entry);
                    }
                    const entry = entries.get(el);
                    if (el.classList.contains('settings-drawer')) el.classList.toggle('is-scrolled', el.scrollTop > 0.5);
                    if (isScrollable(el, 'y') && !entry.axes.has('y')) { entry.axes.add('y'); entry.bars.push(makeBar(el, 'y')); }
                    if (isScrollable(el, 'x') && !entry.axes.has('x')) { entry.axes.add('x'); entry.bars.push(makeBar(el, 'x')); }
                });
                entries.forEach((entry, el) => syncEntry(el, entry));
            };
            let scheduled = false;
            const schedule = () => {
                if (scheduled) return;
                scheduled = true;
                requestAnimationFrame(() => { scheduled = false; refresh(); });
            };
            new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
            window.addEventListener('resize', schedule);
            window.addEventListener('scroll', schedule, true);
            new ResizeObserver(schedule).observe(document.documentElement);
            refresh();
        })();

        function disableKeyboardButtons(root) {
            if (root.matches?.('button')) root.tabIndex = -1;
            root.querySelectorAll?.('button').forEach(button => button.tabIndex = -1);
        }
        disableKeyboardButtons(document);
        new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
            if (node instanceof HTMLElement) disableKeyboardButtons(node);
        }))).observe(document.body, { childList: true, subtree: true });
        document.addEventListener('keydown', event => {
            if (event.target instanceof HTMLButtonElement && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
        }, true);

        const btnUploadAudio = document.getElementById('btn-upload-audio');
        const cuadroDeAudio = document.getElementById('cuadro-de-audio');
        const cuadroDeLetras = document.getElementById('cuadro-de-letras');
        const compactAudioFrame = document.getElementById('compact-audio-frame');
        const compactFullscreenToggle = document.getElementById('compact-fullscreen-toggle');
        const compactSideToggle = document.getElementById('compact-side-toggle');
        const compactSideAnimations = new WeakMap();
        let compactSideControlsTimer;
        let compactFullscreenAnimation = null;
        let fullscreenPositionedControls = [];
        compactSideToggle.addEventListener('click', () => {
            const compactLyricsContent = document.getElementById('compact-lyrics-content');
            const positionedControls = [lyricsEditControls, lyricsAlignmentControls];
            positionedControls.forEach(element => { element.style.visibility = 'hidden'; });
            clearTimeout(compactSideControlsTimer);
            const movingElements = [compactAudioFrame.querySelector('.compact-audio-controls'), compactLyricsContent, compactDivider];
            // Capture the rendered positions before cancelling an in-flight FLIP animation.
            // This lets rapid toggles continue from what is on screen instead of snapping
            // back to the previous layout position.
            const previousRects = movingElements.map(element => element.getBoundingClientRect());
            movingElements.forEach(element => {
                compactSideAnimations.get(element)?.cancel();
                compactSideAnimations.delete(element);
            });
            const reversed = compactAudioFrame.classList.toggle('compact-sides-reversed');
            compactSideToggle.setAttribute('aria-pressed', String(reversed));
            compactSideToggle.textContent = reversed ? '\u21cb Izquierda' : 'Derecha \u21cc';
            const label = reversed ? 'Mover la reproducción a la izquierda' : 'Mover la reproducción a la derecha';
            compactSideToggle.setAttribute('aria-label', label);
            compactSideToggle.title = label;
            updateLyricsAlignmentControls();
            const toggleVersion = (compactSideToggle.dataset.animationVersion = String((Number(compactSideToggle.dataset.animationVersion) || 0) + 1));
            requestAnimationFrame(() => {
                if (compactSideToggle.dataset.animationVersion !== toggleVersion) return;
                movingElements.forEach((element, index) => {
                    const previous = previousRects[index];
                    const current = element.getBoundingClientRect();
                    const deltaX = previous.left - current.left;
                    const deltaY = previous.top - current.top;
                    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;
                    const animation = element.animate(
                        [{ translate: `${deltaX}px ${deltaY}px` }, { translate: '0px 0px' }],
                        { duration: 380, easing: 'cubic-bezier(.22,.61,.36,1)' }
                    );
                    compactSideAnimations.set(element, animation);
                    animation.onfinish = () => {
                        if (compactSideAnimations.get(element) === animation) compactSideAnimations.delete(element);
                    };
                });
                compactSideControlsTimer = setTimeout(() => positionedControls.forEach(element => { element.style.visibility = ''; }), 380);
            });
        });
        compactFullscreenToggle.addEventListener('click', () => {
            const previousFrameRect = compactAudioFrame.getBoundingClientRect();
            compactFullscreenAnimation?.cancel();
            const lyricsAlignmentControls = document.querySelector('.lyrics-alignment-controls');
            const lyricsEditControls = document.querySelector('.lyrics-edit-controls');
            fullscreenPositionedControls = [lyricsAlignmentControls, lyricsEditControls].filter(Boolean);
            fullscreenPositionedControls.forEach(element => { element.style.visibility = 'hidden'; });
            const isFullscreen = document.body.classList.toggle('compact-fullscreen');
            compactFullscreenToggle.setAttribute('aria-pressed', String(isFullscreen));
            compactFullscreenToggle.setAttribute('aria-label', isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa');
            compactFullscreenToggle.title = isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa';
            requestAnimationFrame(() => {
                const currentRect = compactAudioFrame.getBoundingClientRect();
                const scaleX = previousFrameRect.width / currentRect.width;
                const scaleY = previousFrameRect.height / currentRect.height;
                if (Number.isFinite(scaleX) && Number.isFinite(scaleY)) {
                    const targetTransform = getComputedStyle(compactAudioFrame).transform;
                    const targetMatrix = targetTransform === 'none'
                        ? new DOMMatrixReadOnly()
                        : new DOMMatrixReadOnly(targetTransform);
                    const layoutLeft = currentRect.left - targetMatrix.m41;
                    const layoutTop = currentRect.top - targetMatrix.m42;
                    const startMatrix = `matrix(${scaleX}, 0, 0, ${scaleY}, ${previousFrameRect.left - layoutLeft}, ${previousFrameRect.top - layoutTop})`;
                    compactFullscreenAnimation = compactAudioFrame.animate(
                        [
                            { transformOrigin: '0 0', transform: startMatrix },
                            { transformOrigin: '0 0', transform: targetTransform }
                        ],
                        { duration: 420, easing: 'cubic-bezier(.22,.61,.36,1)' }
                    );
                    compactFullscreenAnimation.onfinish = () => {
                        compactFullscreenAnimation = null;
                        updateLyricsAlignmentControls();
                        fullscreenPositionedControls.forEach(element => { element.style.visibility = ''; });
                        fullscreenPositionedControls = [];
                    };
                    compactFullscreenAnimation.oncancel = () => {
                        compactFullscreenAnimation = null;
                        fullscreenPositionedControls.forEach(element => { element.style.visibility = ''; });
                        fullscreenPositionedControls = [];
                    };
                } else {
                    updateLyricsAlignmentControls();
                    fullscreenPositionedControls.forEach(element => { element.style.visibility = ''; });
                    fullscreenPositionedControls = [];
                }
                updateLyricsAlignmentControls();
            });
        });
        const compactAudioControls = compactAudioFrame.querySelector('.compact-audio-controls');
        const compactDivider = document.getElementById('compact-divider');
        const compactLyricsTrack = document.getElementById('compact-lyrics-lines-track');
        const compactSeekbarTrack = document.getElementById('compact-seekbar-track');
        const compactSeekbarFill = document.getElementById('compact-seekbar-fill');
        const compactSeekbarCheckpoints = document.getElementById('compact-seekbar-checkpoints');
        const compactSeekbarThumb = document.getElementById('compact-seekbar-thumb');
        const compactPlayPauseButton = document.getElementById('compact-play-pause');
        const compactIconPlay = document.getElementById('compact-icon-play');
        const compactIconPause = document.getElementById('compact-icon-pause');
        const lyricsContent = document.getElementById('lyrics-content');
        const lyricsLinesTrack = document.getElementById('lyrics-lines-track');
        const lyricsAlignmentButtons = [...document.querySelectorAll('[data-lyrics-align]')];
        lyricsAlignmentButtons.forEach(button => button.addEventListener('click', () => {
            const alignment = button.dataset.lyricsAlign;
            if (button.getAttribute('aria-pressed') === 'true') return;
            const visualRows = [
                ...lyricsLinesTrack.querySelectorAll('.lyrics-visual-row'),
                ...compactLyricsTrack.querySelectorAll('.lyrics-visual-row')
            ];
            const previousLefts = visualRows.map(row => row.getBoundingClientRect().left);
            document.documentElement.style.setProperty('--lyrics-text-align', alignment);
            const rowAlignment = { left: 'flex-start', center: 'center', right: 'flex-end' }[alignment];
            const rowOrigin = { left: 'left center', center: 'center', right: 'right center' }[alignment];
            document.documentElement.style.setProperty('--lyrics-row-align', rowAlignment);
            document.documentElement.style.setProperty('--lyrics-row-origin', rowOrigin);
            lyricsAlignmentButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
            visualRows.forEach((row, index) => {
                const deltaX = previousLefts[index] - row.getBoundingClientRect().left;
                if (Math.abs(deltaX) < 1) return;
                row.animate(
                    [{ translate: `${deltaX}px 0` }, { translate: '0px 0' }],
                    { duration: 300, easing: 'cubic-bezier(.22,.61,.36,1)' }
                );
            });
        }));
        const lyricsEditorTrigger = document.getElementById('lyrics-editor-trigger');
        const lyricsFontIncrease = document.getElementById('lyrics-font-increase');
        const lyricsFontDecrease = document.getElementById('lyrics-font-decrease');
        const lyricsMoveDownTrigger = document.getElementById('lyrics-move-down-trigger');
        const lyricsUndoTrigger = document.getElementById('lyrics-undo-trigger');
        const lyricsSettingsMenu = document.getElementById('lyrics-settings-menu');
        const audioSettingsMenu = document.getElementById('audio-settings-menu');
        const audioLayoutMode = document.getElementById('audio-layout-mode');
        function setDefaultLyricsCornerRadius() {
            document.documentElement.style.setProperty('--letras-corner-size', 'calc(8.5vw * 0.28)');
        }
        function restoreAudioLinkedLyricsCornerRadius() {
            document.documentElement.style.removeProperty('--letras-corner-size');
        }
        function setAudioLayoutMode(nextMode) {
            if (!['floating','full','invisible','compact'].includes(nextMode)) return;
            const wasFull = document.body.classList.contains('audio-mode-full');
            const previousMode = audioLayoutMode.dataset.mode;
            if (nextMode===previousMode) return;
            if (nextMode === 'compact' && previousMode !== 'compact') compactReturnPillOffset = currentPillOffset;
            if (previousMode === 'floating' && nextMode !== 'floating') setDefaultLyricsCornerRadius();
            if (nextMode === 'floating') restoreAudioLinkedLyricsCornerRadius();
            if (!wasFull && nextMode === 'full' && previousMode !== 'invisible') rememberAudioScale();
            if (wasFull && nextMode !== 'full') {
                document.documentElement.style.setProperty('--audio-width', `${audioViewportScale.width}px`);
                document.documentElement.style.setProperty('--audio-height', `${audioViewportScale.height}px`);
                document.documentElement.style.setProperty('--audio-bottom', `${audioViewportScale.bottom}px`);
            }
            audioLayoutMode.dataset.mode = nextMode;
            audioLayoutMode.textContent = { floating: 'Flotante', full: 'Completo', invisible: 'Invisible', compact: 'Compacto' }[nextMode];
            audioLayoutMode.setAttribute('aria-pressed', String(nextMode !== 'floating'));
            document.body.classList.toggle('audio-mode-full', nextMode === 'full');
            document.body.classList.toggle('audio-mode-invisible', nextMode === 'invisible');
            document.body.classList.toggle('audio-mode-compact', nextMode === 'compact');
            if (nextMode === 'compact') normalizeCanvasObjectLayersForCompact();
            audioSettingsMenu.classList.toggle('audio-layout-invisible', nextMode === 'invisible');
            if (previousMode === 'compact' && compactReturnPillOffset !== null) {
                updatePillOffset(compactReturnPillOffset);
                compactReturnPillOffset = null;
            } else {
                updatePillOffset();
            }
            updateLyricsLinePosition();
            updateLyricsAlignmentControls();
            updateAllMarquees();
        }
        audioLayoutMode.addEventListener('click', () => {
            setAudioLayoutMode({ floating: 'full', full: 'invisible', invisible: 'compact', compact: 'floating' }[audioLayoutMode.dataset.mode]);
        });
        const settingsBackdrop = document.getElementById('settings-backdrop');
        const settingsTrigger = document.getElementById('settings-trigger');
        const deleteAudioTrigger = document.getElementById('delete-audio-trigger');
        const overlayImageTrigger = document.getElementById('overlay-image-trigger');
        const overlayImageInput = document.getElementById('overlay-image-input');
        const vinylCoverTrigger = document.getElementById('vinyl-cover-trigger');
        const mediaControlsGroup = document.getElementById('media-controls-group');
        const vinylCoverInput = document.getElementById('vinyl-cover-input');
        const checkpointVisibilityTrigger = document.getElementById('checkpoint-visibility-trigger');
        const optionalControlsVisibilityTrigger = document.getElementById('optional-controls-visibility-trigger');
        const appNotifications = document.getElementById('app-notifications');
        function dismissAppNotification(notification) {
            notification.classList.remove('is-visible');
            setTimeout(() => notification.remove(), 400);
        }
        function showAppNotification({ id, type = 'info', content }) {
            const notification = document.createElement('div');
            notification.className = `app-notification app-notification--${type}`;
            notification.dataset.notificationId = id || `notification-${Date.now()}-${Math.random()}`;
            notification.setAttribute('role', 'status');
            notification.setAttribute('aria-atomic', 'true');
            const icon = document.createElement('span');
            icon.className = 'app-notification__icon';
            icon.setAttribute('aria-hidden', 'true');
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            const iconShapes = {
                warning: [['path', { d: 'M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2.1h16a1.4 1.4 0 0 0 1.2-2.1L12 3Z' }], ['path', { d: 'M12 9v5' }], ['path', { d: 'M12 17.5h.01' }]],
                success: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'm8 12 2.5 2.5L16.5 9' }]],
                info: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M12 11v5' }], ['path', { d: 'M12 8h.01' }]],
                error: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M12 8v5' }], ['path', { d: 'M12 16.5h.01' }]]
            }[type] || [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M12 11v5' }], ['path', { d: 'M12 8h.01' }]];
            iconShapes.forEach(([tag, attributes]) => {
                const shape = document.createElementNS('http://www.w3.org/2000/svg', tag);
                Object.entries(attributes).forEach(([name, value]) => shape.setAttribute(name, value));
                svg.appendChild(shape);
            });
            icon.appendChild(svg);
            const message = document.createElement('span');
            message.className = 'app-notification__message';
            message.append(typeof content === 'string' ? document.createTextNode(content) : content);
            const close = document.createElement('button');
            close.className = 'app-notification__close spring-btn';
            close.type = 'button';
            close.setAttribute('aria-label', 'Cerrar notificación');
            close.title = 'Cerrar';
            close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>';
            close.addEventListener('click', () => dismissAppNotification(notification));
            notification.append(icon, message, close);
            appNotifications.appendChild(notification);
            void notification.offsetWidth;
            requestAnimationFrame(() => notification.classList.add('is-visible'));
            return notification;
        }
        function hideAppNotification(id) {
            [...appNotifications.children]
                .filter(notification => !id || notification.dataset.notificationId === id)
                .forEach(dismissAppNotification);
        }
        checkpointVisibilityTrigger.addEventListener('click', () => {
            const hidden = document.body.classList.toggle('checkpoint-markers-hidden');
            checkpointVisibilityTrigger.setAttribute('aria-pressed', String(hidden));
            checkpointVisibilityTrigger.setAttribute('aria-label', hidden ? 'Mostrar marcas de puntos de control' : 'Ocultar marcas de puntos de control');
            checkpointVisibilityTrigger.title = hidden ? 'Mostrar marcas' : 'Ocultar marcas';
        });
        optionalControlsVisibilityTrigger.addEventListener('click', () => {
            const hidden = document.body.classList.toggle('optional-controls-hidden');
            optionalControlsVisibilityTrigger.setAttribute('aria-pressed', String(hidden));
            optionalControlsVisibilityTrigger.setAttribute('aria-label', hidden ? 'Mostrar botones auxiliares' : 'Ocultar botones auxiliares');
            optionalControlsVisibilityTrigger.title = hidden ? 'Mostrar interfaz' : 'Ocultar interfaz';
            updatePillOffset();
            updateAllMarquees();
            if (hidden) {
                const message = document.createDocumentFragment();
                message.append('Has ocultado la interfaz. Para volver a verla, presiona ');
                const key = document.createElement('kbd');
                key.className = 'app-notification__key';
                key.textContent = 'I';
                message.append(key, '.');
                showAppNotification({ id: 'interface-hidden', type: 'warning', content: message });
            } else {
                hideAppNotification('interface-hidden');
            }
        });
        document.addEventListener('keydown', event => {
            const target = event.target;
            const typing = target instanceof HTMLElement && (
                target.isContentEditable || target.matches('input, textarea, select')
            );
            const key = event.key.toLowerCase();
            if (!['i', 'm'].includes(key) || event.repeat || event.altKey || event.ctrlKey || event.metaKey || typing) return;
            event.preventDefault();
            if (key === 'i') {
                optionalControlsVisibilityTrigger.click();
                return;
            }
            showAppNotification({ id: `test-${Date.now()}`, type: 'success', content: 'Notificación de prueba.' });
        });
        const vinylCoverMenu = document.getElementById('vinyl-cover-menu');
        const vinylCoverReplace = document.getElementById('vinyl-cover-replace');
        const vinylCoverDelete = document.getElementById('vinyl-cover-delete');
        const vinylCoverMode = document.getElementById('vinyl-cover-mode');
        const vinylModeClassicIcon = vinylCoverMode.querySelector('.vinyl-mode-classic');
        const vinylModeModernIcon = vinylCoverMode.querySelector('.vinyl-mode-modern');
        const vinylModePremiumIcon = vinylCoverMode.querySelector('.vinyl-mode-premium');
        const vinylCoverSpin = document.getElementById('vinyl-cover-spin');
        const vinylCoverSpinPlay = vinylCoverSpin.querySelector('.vinyl-cover-spin-play');
        const vinylCoverSpinPause = vinylCoverSpin.querySelector('.vinyl-cover-spin-pause');
        const vinylCoverBorderColor = document.getElementById('vinyl-cover-border-color');
        const vinylCoverBorderWidth = document.getElementById('vinyl-cover-border-width');
        const vinylCoverLayer = document.getElementById('vinyl-cover-layer');
        let activeVinylCover = null;
        let lastVinylCoverSettings = null;
        function syncVinylCoverModeButton(mode) {
            const labels = { classic: 'Clásico', modern: 'Moderno', premium: 'Premium' };
            vinylCoverMode.dataset.mode = mode;
            vinylCoverMode.setAttribute('aria-label', `Cambiar modo del vinilo: ${labels[mode]}`);
            vinylCoverMode.title = `Modo: ${labels[mode]}`;
            vinylModeClassicIcon.classList.toggle('hidden', mode !== 'classic');
            vinylModeModernIcon.classList.toggle('hidden', mode !== 'modern');
            vinylModePremiumIcon.classList.toggle('hidden', mode !== 'premium');
        }
        // Canvas objects stay below the fixed UI and their floating menus.
        // The middle layer sits above lyrics (10) and the upload button (20), below audio (50).
        const getCanvasObjectZIndex = layer => ({ behind: 0, between: 15, front: 55 }[layer]);
        const overlayImageMenu = document.getElementById('overlay-image-menu');
        const overlayImageMenuActions = document.getElementById('overlay-image-menu-actions');
        const lyricsParenthesesControls = document.getElementById('lyrics-parentheses-controls');
        const lyricsParenthesesBackground = document.getElementById('lyrics-parentheses-background');
        const lyricsParenthesesText = document.getElementById('lyrics-parentheses-text');
        const lyricsParenthesesOpacity = document.getElementById('lyrics-parentheses-opacity');
        let activeParenthesesLabel = null, activeParenthesesTag = null;
        const overlayImageLayer = document.getElementById('overlay-image-layer');
        const overlayImageDelete = document.getElementById('overlay-image-delete');
        const overlayImages = [];
        let activeOverlayImage = null, overlayImageDrag = null, overlayImageDragged = false;
        function normalizeCanvasLayer(layer) {
            return document.body.classList.contains('audio-mode-compact') && layer === 'between' ? 'behind' : layer;
        }
        function getNextCanvasLayer(layer) {
            if (document.body.classList.contains('audio-mode-compact')) return layer === 'front' ? 'behind' : 'front';
            return { front: 'behind', behind: 'between', between: 'front' }[layer];
        }
        function normalizeCanvasObjectLayersForCompact() {
            if (activeVinylCover) {
                activeVinylCover.layer = normalizeCanvasLayer(activeVinylCover.layer);
                activeVinylCover.element.style.zIndex = getCanvasObjectZIndex(activeVinylCover.layer);
            }
            overlayImages.forEach(image => {
                image.layer = normalizeCanvasLayer(image.layer);
                image.element.style.zIndex = getCanvasObjectZIndex(image.layer);
            });
        }
        const overlayImageResizeBox = document.createElement('div');
        overlayImageResizeBox.id = 'overlay-image-resize-box';
        overlayImageResizeBox.className = 'hidden';
        ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(handle => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'overlay-resize-handle'; button.dataset.handle = handle;
            button.setAttribute('aria-label', 'Redimensionar imagen');
            overlayImageResizeBox.appendChild(button);
        });
        document.body.appendChild(overlayImageResizeBox);
        let overlayImageResize = null;
        function centerOverlayImageIfFullyOutside(image) {
            if (!image?.isConnected) return;
            const rect = image.getBoundingClientRect();
            if (rect.right <= 0 || rect.left >= innerWidth || rect.bottom <= 0 || rect.top >= innerHeight) {
                const targetLeft = (innerWidth - rect.width) / 2;
                const targetTop = (innerHeight - rect.height) / 2;
                const deltaX = rect.left - targetLeft;
                const deltaY = rect.top - targetTop;
                image.style.left = `${targetLeft}px`;
                image.style.top = `${targetTop}px`;
                updateOverlayImageResizeBox();
                if (typeof image.animate === 'function') {
                    const keyframes = [
                        { transform: `translate(${deltaX}px, ${deltaY}px)` },
                        { transform: 'translate(0, 0)' }
                    ];
                    const options = { duration: 420, easing: 'cubic-bezier(.2,.75,.25,1)' };
                    image.animate(keyframes, options);
                    if (activeOverlayImage?.element === image) overlayImageResizeBox.animate(keyframes, options);
                }
            }
        }
        function updateOverlayImageResizeBox() {
            if (!activeOverlayImage?.element.isConnected) { overlayImageResizeBox.classList.add('hidden'); return; }
            const rect = activeOverlayImage.element.getBoundingClientRect();
            const guideLength = Math.min(window.innerWidth * 0.04, rect.width, rect.height);
            Object.assign(overlayImageResizeBox.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, '--overlay-guide-length': `${guideLength}px` });
            overlayImageResizeBox.classList.remove('hidden');
        }
        document.addEventListener('pointermove', event => {
            if (overlayImageDrag || !activeOverlayImage?.element.isConnected) return;
            const rect = activeOverlayImage.element.getBoundingClientRect();
            const x = event.clientX, y = event.clientY, threshold = 28;
            const nearLeft = Math.abs(x - rect.left) <= threshold;
            const nearRight = Math.abs(x - rect.right) <= threshold;
            const nearTop = Math.abs(y - rect.top) <= threshold;
            const nearBottom = Math.abs(y - rect.bottom) <= threshold;
            const inHorizontalSpan = x >= rect.left - threshold && x <= rect.right + threshold;
            const inVerticalSpan = y >= rect.top - threshold && y <= rect.bottom + threshold;
            const near = {
                'guide-n': nearTop && inHorizontalSpan && !nearLeft && !nearRight,
                'guide-s': nearBottom && inHorizontalSpan && !nearLeft && !nearRight,
                'guide-w': nearLeft && inVerticalSpan && !nearTop && !nearBottom,
                'guide-e': nearRight && inVerticalSpan && !nearTop && !nearBottom,
                'guide-nw': nearLeft && nearTop,
                'guide-ne': nearRight && nearTop,
                'guide-sw': nearLeft && nearBottom,
                'guide-se': nearRight && nearBottom,
            };
            Object.entries(near).forEach(([className, isNear]) => overlayImageResizeBox.classList.toggle(className, isNear));
        }, { passive: true });
        overlayImageResizeBox.addEventListener('pointerdown', event => {
            const handle = event.target.closest('.overlay-resize-handle');
            if (!handle || !activeOverlayImage || event.button !== 0) return;
            event.preventDefault(); event.stopPropagation();
            overlayImageMenu.classList.add('hidden');
            const image = activeOverlayImage.element, rect = image.getBoundingClientRect();
            const direction = handle.dataset.handle;
            overlayImageResize = { id: event.pointerId, direction, x: event.clientX, y: event.clientY,
                left: rect.left, top: rect.top, width: rect.width, height: rect.height,
                ratio: rect.width / Math.max(1, rect.height), image };
            handle.setPointerCapture(event.pointerId);
        });
        overlayImageResizeBox.addEventListener('pointermove', event => {
            const resize = overlayImageResize;
            if (!resize || resize.id !== event.pointerId) return;
            event.preventDefault();
            const d = resize.direction;
            const horizontal = d.includes('e') ? 1 : d.includes('w') ? -1 : 0;
            const vertical = d.includes('s') ? 1 : d.includes('n') ? -1 : 0;
            const deltaX = (event.clientX - resize.x) * horizontal;
            const deltaY = (event.clientY - resize.y) * vertical * resize.ratio;
            const delta = horizontal && vertical
                ? (deltaX + deltaY) / 2
                : horizontal ? deltaX : deltaY;
            const width = Math.max(24, resize.width + delta);
            const height = width / resize.ratio;
            const left = horizontal < 0 ? resize.left + resize.width - width : horizontal === 0 ? resize.left + (resize.width - width) / 2 : resize.left;
            const top = vertical < 0 ? resize.top + resize.height - height : vertical === 0 ? resize.top + (resize.height - height) / 2 : resize.top;
            resize.image.style.width = `${width}px`;
            resize.image.style.left = `${left}px`; resize.image.style.top = `${top}px`;
            updateOverlayImageResizeBox();
        });
        const finishOverlayImageResize = event => {
            if (overlayImageResize?.id !== event.pointerId) return;
            const image = overlayImageResize.image;
            overlayImageResize = null;
            centerOverlayImageIfFullyOutside(image);
        };
        overlayImageResizeBox.addEventListener('pointerup', finishOverlayImageResize);
        overlayImageResizeBox.addEventListener('pointercancel', finishOverlayImageResize);
        window.addEventListener('resize', updateOverlayImageResizeBox);
        const settingsSectionsMenu = document.getElementById('settings-sections-menu');
        const settingsHelpMenu = document.getElementById('settings-help-menu');
        const settingsShortcutsMenu = document.getElementById('settings-shortcuts-menu');
        const settingsHelpTrigger = document.getElementById('settings-help-trigger');
        const settingsShortcutsTrigger = document.getElementById('settings-shortcuts-trigger');
        const backgroundSettingsMenu = document.getElementById('background-settings-menu');
        const managementSettingsMenu = document.getElementById('management-settings-menu');
        const backgroundColorControls = document.getElementById('background-color-controls');
        const backgroundImageLayer = document.getElementById('background-image-layer');
        const backgroundVideoLayer = document.getElementById('background-video-layer');
        const backgroundModeToggle = document.getElementById('background-mode-toggle');
        const backgroundImageControls = document.getElementById('background-image-controls');
        const backgroundImageFileInput = document.getElementById('background-image-file-input');
        const backgroundVideoControls = document.getElementById('background-video-controls');
        const backgroundVideoToggle = document.getElementById('background-video-toggle');
        const backgroundVideoSeekbar = document.getElementById('background-video-seekbar');
        const backgroundVideoPauseIcon = backgroundVideoToggle.querySelector('.background-video-pause-icon');
        const backgroundVideoPlayIcon = backgroundVideoToggle.querySelector('.background-video-play-icon');
        const backgroundImageBlur = document.getElementById('background-image-blur');
        const backgroundImageBlurLabel = backgroundImageControls.querySelector('label[for="background-image-blur"]');
        const syncIconSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 0 0-15.5-6.36L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15.5 6.36L21 16"/><path d="M21 21v-5h-5"/></svg>';
        const uploadIconSvg='<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor;stroke:none"><path d="M12 3.5c.3 0 .5.1.7.3l5 5c.4.4.4 1 0 1.4s-1 .4-1.4 0L13 6.9V16c0 .6-.4 1-1 1s-1-.4-1-1V6.9L7.7 10.2c-.4.4-1 .4-1.4 0s-.4-1 0-1.4l5-5c.2-.2.4-.3.7-.3z"/><path d="M5 19.5c-.6 0-1 .4-1 1s.4 1 1 1h14c.6 0 1-.4 1-1s-.4-1-1-1H5z"/></svg>';
        const settingsSyncButtons = [
            { menu: document.getElementById('background-settings-menu'), mode: 'background', label: 'Sincronizar colores' },
            { menu: document.getElementById('lyrics-settings-menu'), mode: 'lyrics', label: 'Sincronizar colores' },
            { menu: document.getElementById('audio-settings-menu'), mode: 'audio', label: 'Sincronizar colores' }
        ].map(({menu,mode,label}) => {
            const button=document.createElement('button');
            button.type='button';
            button.className='settings-sync-button spring-btn';
            button.innerHTML=syncIconSvg;
            button.dataset.syncColors=mode;
            button.setAttribute('aria-label',label);
            button.title='Sincronizar colores';
            menu.prepend(button);
            return button;
        });
        const backgroundSyncButton=settingsSyncButtons.find(button=>button.dataset.syncColors==='background');
        const backgroundColorSwatches = document.getElementById('background-color-swatches');
        const backgroundColorAdd = document.getElementById('background-color-add');
        let currentBackgroundColors=['#202020'];
        let currentBackgroundMode='color';
        let currentBackgroundImageUrl='';
        let currentBackgroundVideoUrl='';
        const counterSettingsMenu = document.getElementById('counter-settings-menu');
        const counterColorTrigger = document.getElementById('counter-color-trigger');
        const progressColorSwatches = document.getElementById('progress-color-swatches');
        const progressColorAdd = document.getElementById('progress-color-add');
        const counterThumbColorTrigger = document.getElementById('counter-thumb-color-trigger');
        const counterThumbToggle = document.getElementById('counter-thumb-toggle');
        const progressTrackModeToggle = document.getElementById('progress-track-mode-toggle');
        const audioTextColorTrigger = document.getElementById('audio-text-color-trigger');
        const audioIconColorTrigger = document.getElementById('audio-icon-color-trigger');
        const lyricsTextColorTrigger = document.getElementById('lyrics-text-color-trigger');
        const timeElapsedEl = document.getElementById('time-elapsed');
        const timeRemainingEl = document.getElementById('time-remaining');
        const pillControls = document.querySelector('.pill-controls');
        function syncCompactTimeCounters() {
            compactTimeElapsedEl.textContent = timeElapsedEl.textContent;
            compactTimeRemainingEl.textContent = timeRemainingEl.textContent;
        }
        let currentCounterColor = '#ffffff', currentCounterOpacity = 0.1;
        let currentProgressColors=['#ffffff'], currentCounterThumbColor='#ffffff', currentCounterThumbVisible=true;
        let currentProgressTrackMode='dark';
        let currentAudioTextColor = '#ffffff', currentLyricsTextColor = '#ffffff';
        let currentAudioIconColor = '#ffffff';
        const audioColorSwatches = document.getElementById('audio-color-swatches');
        const audioColorAdd = document.getElementById('audio-color-add');
        const audioShadowLightToggle = document.getElementById('audio-shadow-light-toggle');
        const audioGlowColorTrigger = document.getElementById('audio-glow-color-trigger');
        const audioFillBlur = document.getElementById('audio-fill-blur');
        let currentAudioColors=['#202020'], currentAudioOpacity=1;
        const audioFrameImageState={mode:'color',url:''};
        let setAudioFrameMode = () => {};
        let currentAudioGlowMode='shadow', currentAudioGlowColor='#7fbfff';
        const playButtonShadowLightToggle = document.getElementById('play-button-shadow-light-toggle');
        const playButtonGlowColorTrigger = document.getElementById('play-button-glow-color-trigger');
        const playButtonCircleColorTrigger = document.getElementById('play-button-circle-color-trigger');
        const playButtonCircleToggle = document.getElementById('play-button-circle-toggle');
        let currentPlayButtonGlowMode='shadow', currentPlayButtonGlowColor='#7fbfff';
        let currentPlayButtonCircleColor='#323232', playButtonCircleVisible=true;
        const lyricsColorPicker = document.getElementById('lyrics-color-picker');
        const lyricsColorSwatches = document.getElementById('lyrics-color-swatches');
        const lyricsColorAdd = document.getElementById('lyrics-color-add');
        const lyricsShadowLightToggle = document.getElementById('lyrics-shadow-light-toggle');
        const lyricsGlowColorTrigger = document.getElementById('lyrics-glow-color-trigger');
        const lyricsFillBlur = document.getElementById('lyrics-fill-blur');
        const lyricsFillOpacity = document.getElementById('lyrics-fill-opacity');
        let draggedColorButton = null, colorDropTarget = null, colorDropBefore = true, suppressColorClick = false;
        const lyricsColorCanvas = document.getElementById('lyrics-color-canvas');
        const lyricsColorMarker = document.getElementById('lyrics-color-marker');
        const lyricsColorHue = document.getElementById('lyrics-color-hue');
        const lyricsColorOpacity = document.getElementById('lyrics-color-opacity');
        const lyricsColorBrightness = document.getElementById('lyrics-color-brightness');
        const lyricsColorHex = document.getElementById('lyrics-color-hex');
        const lyricsColorPreview = document.getElementById('lyrics-color-preview');
        const lyricsColorReset = document.getElementById('lyrics-color-reset');
        const lyricsColorDelete = document.getElementById('lyrics-color-delete');
        let pickerHue = 0, pickerSaturation = 0, pickerValue = 0.125, pickerOpacity = 1, pickerBrightness = 50, pickerOriginal = '#202020', currentLyricsColors = ['#202020'], currentLyricsColor = '#202020', currentLyricsOpacity = 1, activeLyricsColorIndex = 0;
        const lyricsFrameImageState={mode:'color',url:''};
        let setLyricsFrameMode = () => {};
        let currentLyricsGlowMode='shadow', currentLyricsGlowColor='#7fbfff';
        const frameShadowReferenceViewport={width:window.innerWidth,height:window.innerHeight};
        let activeColorPickerOptions = null;
        const lyricsEditorBackdrop = document.getElementById('lyrics-editor-backdrop');
        const lyricsEditorPanelWrap = document.getElementById('lyrics-editor-panel-wrap');
        const lyricsEditorPanel = document.getElementById('lyrics-editor-panel');
        const lyricsEditorResizeHandle = document.getElementById('lyrics-editor-resize-handle');
        const lyricsEditorGuideLine = document.getElementById('lyrics-editor-guide-line');
        const lyricsEditorSideToggle = document.getElementById('lyrics-editor-side-toggle');
        let lyricsEditorSideAnimation = null;
        let isLyricsEditorResizing = false;
        const audioInput = document.getElementById('audio-input');
        document.getElementById('compact-upload-button').addEventListener('click', () => audioInput.click());
        const audioSideImageMenu = document.getElementById('audio-side-image-menu');
        const audioSideImageReplace = document.getElementById('audio-side-image-replace');
        const audioSideImageShape = document.getElementById('audio-side-image-shape');
        const audioSideImageShapeSquare = audioSideImageShape.querySelector('.audio-side-image-shape-square');
        const audioSideImageShapeCircle = audioSideImageShape.querySelector('.audio-side-image-shape-circle');
        const audioSideImageSpin = document.getElementById('audio-side-image-spin');
        const audioSideImageSpinPlay = audioSideImageSpin.querySelector('.audio-side-image-spin-play');
        const audioSideImageSpinPause = audioSideImageSpin.querySelector('.audio-side-image-spin-pause');
        const audioSideImageDelete = document.getElementById('audio-side-image-delete');
        let activeAudioSideImage = null;
        function syncAudioSideImageMargin() {
            const hasImage = audioSideImageControls.some(state => Boolean(state.url));
            document.body.classList.toggle('audio-side-image-loaded', hasImage);
            syncCompactAudioSideImageButton();
            updatePillOffset();
            updateAllMarquees();
        }
        function syncAudioSideImageMenu() {
            if (!activeAudioSideImage) return;
            const nextShapeLabel = activeAudioSideImage.shape === 'circle' ? 'cuadrada' : 'circular';
            audioSideImageShape.setAttribute('aria-label', `Cambiar forma a ${nextShapeLabel}`);
            audioSideImageShape.title = `Cambiar forma a ${nextShapeLabel}`;
            audioSideImageShapeSquare.classList.toggle('hidden', activeAudioSideImage.shape === 'circle');
            audioSideImageShapeCircle.classList.toggle('hidden', activeAudioSideImage.shape !== 'circle');
            audioSideImageSpin.classList.toggle('hidden', activeAudioSideImage.shape !== 'circle');
            audioSideImageSpin.setAttribute('aria-pressed', String(activeAudioSideImage.spinning));
            const spinLabel = activeAudioSideImage.spinning ? 'Detener giro' : 'Iniciar giro';
            audioSideImageSpin.setAttribute('aria-label', spinLabel);
            audioSideImageSpin.title = spinLabel;
            audioSideImageSpinPlay.classList.toggle('hidden', activeAudioSideImage.spinning);
            audioSideImageSpinPause.classList.toggle('hidden', !activeAudioSideImage.spinning);
        }
        function openAudioSideImageMenu(state, anchor) {
            if (!audioSideImageMenu.classList.contains('hidden') && activeAudioSideImage === state) {
                audioSideImageMenu.classList.add('hidden');
                return;
            }
            activeAudioSideImage = state;
            syncAudioSideImageMenu();
            audioSideImageMenu.classList.remove('hidden');
            const menuRect = audioSideImageMenu.getBoundingClientRect();
            const anchorRect = anchor.getBoundingClientRect();
            const edge = 8;
            const x = anchorRect.left + (anchorRect.width - menuRect.width) / 2;
            const y = anchorRect.top - menuRect.height - edge;
            audioSideImageMenu.style.left = `${Math.max(edge, Math.min(x, innerWidth - menuRect.width - edge))}px`;
            audioSideImageMenu.style.top = `${Math.max(edge, Math.min(y, innerHeight - menuRect.height - edge))}px`;
        }
        const audioSideImageControls = ['left', 'right'].map(side => {
            const button = document.getElementById(`audio-image-${side}-button`);
            const input = document.getElementById(`audio-image-${side}-input`);
            const image = button.querySelector('.audio-side-image-preview');
            const state = { side, button, input, image, url: '', shape: 'square', spinning: false };
            button.addEventListener('click', () => {
                if (state.url) openAudioSideImageMenu(state, button);
                else input.click();
            });
            input.addEventListener('change', () => {
                const file = input.files?.[0];
                input.value = '';
                if (!file) return;
                const nextUrl = URL.createObjectURL(file);
                image.hidden = true;
                image.onload = () => {
                    if (state.url) URL.revokeObjectURL(state.url);
                    state.url = nextUrl;
                    image.hidden = false;
                    button.classList.add('has-image');
                    syncAudioSideImageMargin();
                    image.onload = null;
                    image.onerror = null;
                };
                image.onerror = () => {
                    URL.revokeObjectURL(nextUrl);
                    if (state.url) {
                        image.onload = () => {
                            image.hidden = false;
                            image.onload = null;
                            image.onerror = null;
                        };
                        image.src = state.url;
                    }
                    else {
                        image.removeAttribute('src');
                        button.classList.remove('has-image');
                        syncAudioSideImageMargin();
                        image.onload = null;
                        image.onerror = null;
                    }
                };
                image.src = nextUrl;
            });
            return state;
        });
        const compactAudioSideImageButton = audioSideImageControls[0].button.cloneNode(true);
        compactAudioSideImageButton.removeAttribute('id');
        compactAudioSideImageButton.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
        compactAudioSideImageButton.classList.remove('left', 'right');
        compactAudioSideImageButton.classList.add('compact-side-image-button');
        compactAudioSideImageButton.id = 'compact-audio-image-button';
        compactAudioSideImageButton.setAttribute('aria-label', 'Añadir imagen al panel compacto');
        compactAudioSideImageButton.title = 'Añadir imagen';
        compactAudioControls.appendChild(compactAudioSideImageButton);

        function getCompactAudioSideImageState() {
            return audioSideImageControls.find(state => Boolean(state.url)) || null;
        }
        function syncCompactAudioSideImageButton() {
            const state = getCompactAudioSideImageState();
            const preview = compactAudioSideImageButton.querySelector('.audio-side-image-preview');
            const hasImage = Boolean(state);
            compactAudioFrame.classList.toggle('has-compact-side-image', hasImage);
            compactAudioSideImageButton.classList.toggle('has-image', hasImage);
            compactAudioSideImageButton.classList.toggle('circle', hasImage && state.shape === 'circle');
            compactAudioSideImageButton.classList.toggle('spinning', hasImage && state.spinning);
            if (hasImage) {
                const source = state.image.getAttribute('src');
                if (preview.getAttribute('src') !== source) preview.setAttribute('src', source);
                preview.hidden = false;
                compactAudioSideImageButton.setAttribute('aria-label', 'Editar la imagen del panel compacto');
                compactAudioSideImageButton.title = 'Editar imagen';
            } else {
                preview.removeAttribute('src');
                preview.hidden = true;
                compactAudioSideImageButton.setAttribute('aria-label', 'Añadir imagen al panel compacto');
                compactAudioSideImageButton.title = 'Añadir imagen';
            }
        }
        compactAudioSideImageButton.addEventListener('click', () => {
            const state = getCompactAudioSideImageState();
            if (state) {
                openAudioSideImageMenu(state, compactAudioSideImageButton);
            } else {
                audioSideImageControls[0].input.click();
            }
        });
        syncCompactAudioSideImageButton();

        audioSideImageReplace.addEventListener('click', () => {
            if (!activeAudioSideImage) return;
            audioSideImageMenu.classList.add('hidden');
            activeAudioSideImage.input.click();
        });
        audioSideImageShape.addEventListener('click', () => {
            if (!activeAudioSideImage) return;
            activeAudioSideImage.shape = activeAudioSideImage.shape === 'square' ? 'circle' : 'square';
            activeAudioSideImage.button.classList.toggle('circle', activeAudioSideImage.shape === 'circle');
            if (activeAudioSideImage.shape !== 'circle' && activeAudioSideImage.spinning) {
                activeAudioSideImage.spinning = false;
                activeAudioSideImage.button.classList.remove('spinning');
            }
            syncCompactAudioSideImageButton();
            syncAudioSideImageMenu();
        });
        audioSideImageSpin.addEventListener('click', () => {
            if (!activeAudioSideImage || activeAudioSideImage.shape !== 'circle') return;
            activeAudioSideImage.spinning = !activeAudioSideImage.spinning;
            activeAudioSideImage.button.classList.toggle('spinning', activeAudioSideImage.spinning);
            syncCompactAudioSideImageButton();
            syncAudioSideImageMenu();
        });
        audioSideImageDelete.addEventListener('click', () => {
            if (!activeAudioSideImage) return;
            if (activeAudioSideImage.url) URL.revokeObjectURL(activeAudioSideImage.url);
            activeAudioSideImage.url = '';
            activeAudioSideImage.image.removeAttribute('src');
            activeAudioSideImage.image.hidden = true;
            activeAudioSideImage.shape = 'square';
            activeAudioSideImage.spinning = false;
            activeAudioSideImage.button.classList.remove('has-image', 'circle', 'spinning');
            syncAudioSideImageMargin();
            audioSideImageMenu.classList.add('hidden');
            activeAudioSideImage = null;
        });

        const btnPlayPause = document.getElementById('btn-play-pause');
        const iconPlay = document.getElementById('icon-play');
        const iconPause = document.getElementById('icon-pause');
        const audioPanel = document.getElementById('cuadro-de-audio');
        function setAnimatedPosition(container, className, movingElements, active) {
            if (container.classList.contains(className) === active) return;
            const before = movingElements.map(element => element.getBoundingClientRect());
            container.classList.toggle(className, active);
            movingElements.forEach((element, index) => {
                const after = element.getBoundingClientRect();
                const deltaX = before[index].left - after.left;
                const deltaY = before[index].top - after.top;
                if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;
                element.animate([
                    { translate: `${deltaX}px ${deltaY}px` },
                    { translate: '0px 0px' }
                ], { duration: 320, easing: 'cubic-bezier(.2,.75,.25,1)' });
            });
        }

        const btnRewind10 = document.getElementById('btn-rewind-10');
        const btnForward10 = document.getElementById('btn-forward-10');
        const compactPlaybackButtons = compactAudioFrame.querySelector('.compact-playback-buttons');
        const compactPlaybackPill = compactAudioFrame.querySelector('.compact-playback-pill');
        const compactTimeElapsedEl = document.getElementById('compact-time-elapsed');
        const compactTimeRemainingEl = document.getElementById('compact-time-remaining');
        function cloneCompactSkipButton(source, position) {
            const button = source.cloneNode(true);
            button.removeAttribute('id');
            button.classList.remove('btn-skip');
            button.classList.add('compact-playback-skip');
            button.classList.add(position === 'before' ? 'compact-rewind-skip' : 'compact-forward-skip');
            button.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
            if (position === 'before') compactPlaybackButtons.insertBefore(button, compactPlayPauseButton);
            else compactPlaybackButtons.appendChild(button);
            return button;
        }
        const compactRewindButton = cloneCompactSkipButton(btnRewind10, 'before');
        const compactForwardButton = cloneCompactSkipButton(btnForward10, 'after');
        const compactControlsPositionToggle = document.getElementById('lyrics-move-down-trigger').cloneNode(true);
        compactControlsPositionToggle.id = 'compact-controls-position-toggle';
        compactControlsPositionToggle.removeAttribute('tabindex');
        compactControlsPositionToggle.classList.remove('app-button');
        compactControlsPositionToggle.classList.add('compact-controls-position-toggle');
        compactControlsPositionToggle.setAttribute('aria-label', 'Mover los controles debajo de la barra de progreso');
        compactControlsPositionToggle.setAttribute('aria-pressed', 'false');
        compactControlsPositionToggle.title = 'Mover abajo';
        compactPlaybackButtons.appendChild(compactControlsPositionToggle);
        const audioControlsPositionToggle = compactControlsPositionToggle.cloneNode(true);
        audioControlsPositionToggle.id = 'audio-controls-position-toggle';
        audioControlsPositionToggle.classList.remove('compact-controls-position-toggle');
        audioControlsPositionToggle.classList.add('audio-controls-position-toggle');
        audioControlsPositionToggle.removeAttribute('tabindex');
        audioPanel.querySelector('.controls-wrapper').appendChild(audioControlsPositionToggle);
        function setSharedControlsPosition(controlsBelowSeekbar) {
            setAnimatedPosition(audioPanel, 'controls-below-seekbar', [
                audioPanel.querySelector('.controls-wrapper'),
                audioPanel.querySelector('.seekbar-container')
            ], controlsBelowSeekbar);
            setAnimatedPosition(compactAudioFrame, 'controls-below-seekbar', [
                compactPlaybackButtons,
                compactAudioFrame.querySelector('.compact-seekbar-row'),
                ...compactAudioFrame.querySelectorAll('.compact-text-add-button, .compact-added-text-container')
            ], controlsBelowSeekbar);
            const label = controlsBelowSeekbar
                ? 'Mover los controles encima de la barra de progreso'
                : 'Mover los controles debajo de la barra de progreso';
            [audioControlsPositionToggle, compactControlsPositionToggle].forEach(button => {
                const paths = button.querySelectorAll('svg path');
                paths[0].setAttribute('d', controlsBelowSeekbar ? 'M12 19V4' : 'M12 4v15');
                paths[1].setAttribute('d', controlsBelowSeekbar ? 'm6 11 6-6 6 6' : 'm6 13 6 6 6-6');
                button.setAttribute('aria-label', label);
                button.setAttribute('aria-pressed', String(controlsBelowSeekbar));
                button.title = controlsBelowSeekbar ? 'Mover arriba' : 'Mover abajo';
            });
            updateAllMarquees();
        }
        audioControlsPositionToggle.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            setSharedControlsPosition(!compactAudioFrame.classList.contains('controls-below-seekbar'));
        });
        function isPointerNearRect(clientX, clientY, rect, margin) {
            return clientX >= rect.left - margin && clientX <= rect.right + margin &&
                clientY >= rect.top - margin && clientY <= rect.bottom + margin;
        }
        compactAudioControls.addEventListener('pointermove', event => {
            if (event.pointerType === 'touch') return;
            const toggleRect = compactControlsPositionToggle.getBoundingClientRect();
            const buttonsRect = compactPlaybackButtons.getBoundingClientRect();
            const margin = Math.max(12, toggleRect.width * 0.25);
            const nearControls = isPointerNearRect(event.clientX, event.clientY, buttonsRect, margin) ||
                isPointerNearRect(event.clientX, event.clientY, toggleRect, margin);
            compactAudioFrame.classList.toggle('controls-position-toggle-nearby', nearControls);
        });
        compactAudioControls.addEventListener('pointerleave', () => {
            compactAudioFrame.classList.remove('controls-position-toggle-nearby');
        });
        compactControlsPositionToggle.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            setSharedControlsPosition(!compactAudioFrame.classList.contains('controls-below-seekbar'));
        });
        function syncCompactDividerAria() {
            const style = getComputedStyle(compactAudioFrame);
            const scale = parseFloat(style.getPropertyValue('--compact-divider-offset-scale')) || 2.7;
            const unit = window.innerWidth * 0.085;
            const maxScale = Math.max(2.7, compactAudioFrame.clientWidth / unit - 2.7);
            compactDivider.setAttribute('aria-valuemin', '27');
            compactDivider.setAttribute('aria-valuemax', String(Math.round(maxScale * 10)));
            compactDivider.setAttribute('aria-valuenow', String(Math.round(scale * 10)));
        }
        function setCompactDividerOffsetScale(scale) {
            const unit = window.innerWidth * 0.085;
            const minScale = 2.7;
            const maxScale = Math.max(minScale, compactAudioFrame.clientWidth / unit - minScale);
            const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
            compactAudioFrame.style.setProperty('--compact-divider-offset-scale', String(clampedScale));
            syncCompactDividerAria();
            updateLyricsAlignmentControls();
        }
        function fitCompactDividerToWidth(frameWidth) {
            const unit = window.innerWidth * 0.085;
            const currentScale = parseFloat(getComputedStyle(compactAudioFrame).getPropertyValue('--compact-divider-offset-scale')) || 2.7;
            const maxScale = Math.max(2.7, frameWidth / unit - 2.7);
            const fittedScale = Math.max(2.7, Math.min(currentScale, maxScale));
            compactAudioFrame.style.setProperty('--compact-divider-offset-scale', String(fittedScale));
            syncCompactDividerAria();
        }
        function moveCompactDivider(clientX) {
            const rect = compactAudioFrame.getBoundingClientRect();
            const unit = window.innerWidth * 0.085;
            const reversed = compactAudioFrame.classList.contains('compact-sides-reversed');
            setCompactDividerOffsetScale((reversed ? rect.right - clientX : clientX - rect.left) / unit);
        }
        let compactDividerPointerId = null;
        compactDivider.addEventListener('pointerdown', event => {
            if (isResizingActive || compactDividerPointerId !== null) return;
            event.preventDefault();
            compactDividerPointerId = event.pointerId;
            compactAudioFrame.classList.add('divider-dragging');
            compactDivider.setPointerCapture(event.pointerId);
            moveCompactDivider(event.clientX);
        });
        compactDivider.addEventListener('pointermove', event => {
            if (event.pointerId === compactDividerPointerId) moveCompactDivider(event.clientX);
        });
        function finishCompactDividerDrag(event) {
            if (event.pointerId !== compactDividerPointerId) return;
            compactDividerPointerId = null;
            compactAudioFrame.classList.remove('divider-dragging');
            if (compactDivider.hasPointerCapture(event.pointerId)) compactDivider.releasePointerCapture(event.pointerId);
        }
        compactDivider.addEventListener('pointerup', finishCompactDividerDrag);
        compactDivider.addEventListener('pointercancel', finishCompactDividerDrag);
        compactDivider.addEventListener('keydown', event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const scale = parseFloat(getComputedStyle(compactAudioFrame).getPropertyValue('--compact-divider-offset-scale')) || 2.7;
            const direction = event.key === 'ArrowRight' ? 1 : -1;
            setCompactDividerOffsetScale(scale + direction * (compactAudioFrame.classList.contains('compact-sides-reversed') ? -0.1 : 0.1));
        });
        const compactTimeCounterObserver = new MutationObserver(syncCompactTimeCounters);
        compactTimeCounterObserver.observe(timeElapsedEl, { childList: true, characterData: true, subtree: true });
        compactTimeCounterObserver.observe(timeRemainingEl, { childList: true, characterData: true, subtree: true });
        syncCompactTimeCounters();

        const audioElement = new Audio();
        const audioVolumeSlider = document.getElementById('audio-volume-slider');
        audioVolumeSlider.addEventListener('input', () => {
            audioElement.volume = Number(audioVolumeSlider.value) / 100;
        });
        let endedResetTimer = null;
        const seekbarContainer = document.getElementById('seekbar-container');

        const seekbarTrack = document.getElementById('seekbar-track');
        const seekbarCheckpoints = document.getElementById('seekbar-checkpoints');
        const seekbarFill = document.getElementById('seekbar-fill');
        const seekbarThumb = document.getElementById('seekbar-thumb');

        const btnAdd = document.getElementById('btn-add');
        const btnAddRight = document.getElementById('btn-add-right');
        const addedTextContainer = document.getElementById('added-text-container');
        const addedTextContainerRight = document.getElementById('added-text-container-right');
        function cloneCompactTextElement(source, className) {
            const clone = source.cloneNode(true);
            clone.removeAttribute('id');
            clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
            clone.classList.add(className);
            return clone;
        }
        const compactBtnAddLeft = cloneCompactTextElement(btnAdd, 'compact-text-add-button');
        compactBtnAddLeft.id = 'compact-btn-add-left';
        compactBtnAddLeft.classList.add('compact-text-add-left');
        compactBtnAddLeft.setAttribute('aria-label', 'Añadir título');
        compactBtnAddLeft.removeAttribute('title');
        const compactBtnAddRight = cloneCompactTextElement(btnAddRight, 'compact-text-add-button');
        compactBtnAddRight.id = 'compact-btn-add-right';
        compactBtnAddRight.classList.add('compact-text-add-right');
        compactBtnAddRight.setAttribute('aria-label', 'Añadir título');
        compactBtnAddRight.removeAttribute('title');
        compactAudioControls.append(compactBtnAddLeft, compactBtnAddRight);

        const compactAddedTextContainer = cloneCompactTextElement(addedTextContainer, 'compact-added-text-container');
        compactAddedTextContainer.classList.add('compact-added-text-left');
        compactAddedTextContainer.setAttribute('role', 'button');
        compactAddedTextContainer.setAttribute('tabindex', '0');
        compactAddedTextContainer.setAttribute('aria-label', 'Editar el texto de la izquierda');
        const compactAddedTextContainerRight = cloneCompactTextElement(addedTextContainerRight, 'compact-added-text-container');
        compactAddedTextContainerRight.classList.add('compact-added-text-right');
        compactAddedTextContainerRight.setAttribute('role', 'button');
        compactAddedTextContainerRight.setAttribute('tabindex', '0');
        compactAddedTextContainerRight.setAttribute('aria-label', 'Editar el texto de la derecha');
        compactAudioControls.append(compactAddedTextContainer, compactAddedTextContainerRight);
        const [compactWrapperTop, compactWrapperBottom] = compactAddedTextContainer.querySelectorAll('.marquee-wrapper');
        const [compactWrapperRightTop, compactWrapperRightBottom] = compactAddedTextContainerRight.querySelectorAll('.marquee-wrapper');
        const [compactTrackTop, compactTrackBottom] = compactAddedTextContainer.querySelectorAll('.marquee-track');
        const [compactTrackRightTop, compactTrackRightBottom] = compactAddedTextContainerRight.querySelectorAll('.marquee-track');
        const compactAddedTextTop = compactAddedTextContainer.querySelector('.added-text-top');
        const compactAddedTextBottom = compactAddedTextContainer.querySelector('.added-text-bottom');
        const compactAddedTextRightTop = compactAddedTextContainerRight.querySelector('.added-text-top');
        const compactAddedTextRightBottom = compactAddedTextContainerRight.querySelector('.added-text-bottom');
        const modalText = document.getElementById('modal-text');
        const inputTop = document.getElementById('input-top');
        const inputBottom = document.getElementById('input-bottom');
        const btnModalCancel = document.getElementById('btn-modal-cancel');
        const btnModalAccept = document.getElementById('btn-modal-accept');
        const addedTextTop = document.getElementById('added-text-top');
        const addedTextBottom = document.getElementById('added-text-bottom');
        const addedTextRightTop = document.getElementById('added-text-right-top');
        const addedTextRightBottom = document.getElementById('added-text-right-bottom');

        const wrapperTop = document.getElementById('wrapper-top');
        const wrapperBottom = document.getElementById('wrapper-bottom');
        const trackTop = document.getElementById('track-top');
        const trackBottom = document.getElementById('track-bottom');
        const wrapperRightTop = document.getElementById('wrapper-right-top');
        const wrapperRightBottom = document.getElementById('wrapper-right-bottom');
        const trackRightTop = document.getElementById('track-right-top');
        const trackRightBottom = document.getElementById('track-right-bottom');
        let editingTextSide = 'left';
        const textDialog = modalText.querySelector('.audio-text-dialog');
        let textDialogClosing = false;
        function openTextDialog(trigger) {
            if (textDialogClosing) return;
            const rect = trigger?.getBoundingClientRect();
            const x = rect ? rect.left + rect.width / 2 - innerWidth / 2 : 0;
            const y = rect ? rect.top + rect.height / 2 - innerHeight / 2 : 0;
            modalText.style.setProperty('--audio-delete-start-x', `${x}px`);
            modalText.style.setProperty('--audio-delete-start-y', `${y}px`);
            modalText.classList.remove('hidden', 'is-closing', 'is-opening');
            void modalText.offsetWidth;
            modalText.classList.add('is-opening');
            inputTop.focus();
        }
        function closeTextDialog(afterClose) {
            if (textDialogClosing || modalText.classList.contains('hidden')) return;
            textDialogClosing = true;
            modalText.classList.remove('is-opening');
            modalText.classList.add('is-closing');
            const finish = event => {
                if (event?.type === 'animationend' && (event.target !== textDialog || event.animationName !== 'audio-delete-spring-out')) return;
                textDialog.removeEventListener('animationend', finish);
                textDialog.removeEventListener('animationcancel', finish);
                modalText.classList.add('hidden');
                modalText.classList.remove('is-closing');
                textDialogClosing = false;
                afterClose?.();
            };
            textDialog.addEventListener('animationend', finish);
            textDialog.addEventListener('animationcancel', finish);
        }
        modalText.addEventListener('click', event => { if (event.target === modalText) closeTextDialog(); });
        modalText.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeTextDialog(); }
        });

        let isSeeking = false;
        let pendingSeekTime = null;
        const lyricsAlignmentControls = document.querySelector('.lyrics-alignment-controls');
        const lyricsEditControls = document.querySelector('.lyrics-edit-controls');
        function updateLyricsAlignmentControls() {
            const compactVisible = getComputedStyle(compactAudioFrame).display !== 'none';
            const rect = (compactVisible ? compactAudioFrame : cuadroDeLetras).getBoundingClientRect();
            const lyricsRect = compactVisible
                ? document.getElementById('compact-lyrics-content').getBoundingClientRect()
                : rect;
            if (compactVisible && compactAudioFrame.clientWidth) {
                syncCompactDividerAria();
            }
            const margin = 22;
            const buttonSize = 30;
            const gap = 4;
            const visibleLeft = Math.max(margin, lyricsRect.left + margin);
            const visibleTop = Math.max(0, rect.top) + margin;
            const visibleRight = Math.min(window.innerWidth, lyricsRect.right) - margin;
            const visibleBottom = Math.min(window.innerHeight, rect.bottom) - margin;
            const availableWidth = visibleRight - visibleLeft;
            const availableHeight = visibleBottom - visibleTop;
            const fixedControlIds = [
                'settings-trigger', 'delete-audio-trigger', 'overlay-image-trigger', 'vinyl-cover-trigger', 'cuadro-de-audio', 'btn-upload-audio', 'compact-side-toggle',
                'optional-controls-visibility-trigger', 'checkpoint-visibility-trigger',
                'lyrics-move-down-trigger', 'lyrics-undo-trigger'
            ];
            const controlClearance = 28;
            const blockedRects = fixedControlIds
                .map(id => document.getElementById(id))
                .filter(element => element && !element.classList.contains('hidden') && getComputedStyle(element).display !== 'none')
                .map(element => {
                    const rect = element.getBoundingClientRect();
                    return { left: rect.left - controlClearance, right: rect.right + controlClearance, top: rect.top - controlClearance, bottom: rect.bottom + controlClearance };
                });
            const placeWithoutOverlap = (element, width, height, preferredLeft, preferredTop, extraBlocked = []) => {
                const maxLeft = visibleRight - width;
                const maxTop = visibleBottom - height;
                if (maxLeft < visibleLeft || maxTop < visibleTop) return false;
                const obstacles = [...blockedRects, ...extraBlocked];
                const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
                const leftCandidates = new Set([clamp(preferredLeft, visibleLeft, maxLeft), visibleLeft, maxLeft]);
                const topCandidates = new Set([clamp(preferredTop, visibleTop, maxTop), visibleTop, maxTop]);
                obstacles.forEach(rect => {
                    leftCandidates.add(clamp(rect.left - width, visibleLeft, maxLeft));
                    leftCandidates.add(clamp(rect.right, visibleLeft, maxLeft));
                    topCandidates.add(clamp(rect.top - height, visibleTop, maxTop));
                    topCandidates.add(clamp(rect.bottom, visibleTop, maxTop));
                });
                let best = null;
                for (const top of topCandidates) {
                    for (const left of leftCandidates) {
                        const right = left + width;
                        const bottom = top + height;
                        const overlaps = obstacles.some(rect =>
                            left < rect.right && right > rect.left && top < rect.bottom && bottom > rect.top
                        );
                        if (overlaps) continue;
                        const distance = Math.hypot(left - preferredLeft, top - preferredTop);
                        if (!best || distance < best.distance) best = { left, top, distance };
                    }
                }
                if (!best) return false;
                element.style.left = `${best.left}px`;
                element.style.top = `${best.top}px`;
                element.classList.remove('hidden');
                return true;
            };
            const horizontalWidth = lyricsAlignmentButtons.length * buttonSize + (lyricsAlignmentButtons.length - 1) * gap;
            const horizontalFits = availableWidth >= horizontalWidth && availableHeight >= buttonSize;
            const verticalFits = availableWidth >= buttonSize && availableHeight >= horizontalWidth;

            if (!horizontalFits && !verticalFits) {
                lyricsAlignmentControls.classList.add('hidden');
            } else {
                const vertical = !horizontalFits;
                lyricsAlignmentControls.style.flexDirection = vertical ? 'column' : 'row';
                const controlsWidth = vertical ? buttonSize : horizontalWidth;
                const controlsHeight = vertical ? horizontalWidth : buttonSize;
                const preferredLeft = compactVisible ? visibleLeft : rect.left + margin;
                const preferredTop = visibleTop;
                if (!placeWithoutOverlap(lyricsAlignmentControls, controlsWidth, controlsHeight, preferredLeft, preferredTop)) {
                    lyricsAlignmentControls.classList.add('hidden');
                }
            }

            const editButtonSize = 30;
            const editGap = 4;
            const editCount = 3;
            const editGroupHeight = editCount * editButtonSize + (editCount - 1) * editGap;
            if (availableWidth < editButtonSize || availableHeight < editGroupHeight) {
                lyricsEditControls.classList.add('hidden');
                return;
            }
            lyricsEditControls.style.flexDirection = 'column';
            const alignmentRect = lyricsAlignmentControls.classList.contains('hidden')
                ? null
                : lyricsAlignmentControls.getBoundingClientRect();
            if (!placeWithoutOverlap(
                lyricsEditControls,
                editButtonSize,
                editGroupHeight,
                visibleRight - editButtonSize,
                visibleTop,
                alignmentRect ? [alignmentRect] : []
            )) lyricsEditControls.classList.add('hidden');
        }

        updateLyricsAlignmentControls();
        let activeLyricsLine = 0;
        let lyricsLineGroups = [];
        let lyricsGroupSourceRows = [];
        let lyricsCheckpoints = [{ time: 0, row: -1, explicit: false }];
        let selectedLyricsCheckpointTime = null;
        const movementHistory = [];
        let movementHistoryIndex = 0;
        function clearMovementHistory() {
            movementHistory.length = 0;
            movementHistoryIndex = 0;
        }
        function recordMovement(undo, redo) {
            movementHistory.splice(movementHistoryIndex);
            movementHistory.push({ undo, redo });
            if (movementHistory.length > 20) movementHistory.shift();
            movementHistoryIndex = movementHistory.length;
        }
        function undoMovement() {
            if (movementHistoryIndex) movementHistory[--movementHistoryIndex].undo();
        }
        function redoMovement() {
            if (movementHistoryIndex < movementHistory.length) movementHistory[movementHistoryIndex++].redo();
        }
        const lyricsTagStyles = new Map();
        const lyricsTagPalette = ['#ff5c5c', '#ff9f43', '#ffd43b', '#58d68d', '#35c9c3', '#5dade2', '#8e7cff', '#e879c5'];
        const lyricsTagDefaultColors = new Map([
            ['intro', '#23D2EA'], ['introduccion', '#23D2EA'], ['introduction', '#23D2EA'],
            ['coro', '#D35C97'], ['chorus', '#D35C97'], ['estribillo', '#D35C97'],
            ['verso', '#876CE2'], ['verse', '#876CE2'],
            ['prechorus', '#B383E0'], ['precoro', '#B383E0'],
            ['bridge', '#E0805A'], ['puente', '#E0805A'],
            ['ending', '#A7E43A'], ['final', '#A7E43A'], ['outro', '#A7E43A'],
            ['solo', '#DEAF39']
        ]);
        const normalizeLyricsTagLabel = label => label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        let lyricsTagOpacity = 0.4, lyricsTagBrightness = 25;
        function getLyricsTagStyle(label) {
            const key = normalizeLyricsTagLabel(label);
            if (!lyricsTagStyles.has(key)) {
                const color = lyricsTagDefaultColors.get(key) || lyricsTagPalette[Math.floor(Math.random() * lyricsTagPalette.length)];
                lyricsTagStyles.set(key, {
                    color,
                    initialColor: color
                });
            }
            return lyricsTagStyles.get(key);
        }
        function getLyricsTagBackground(color, brightness, opacity) {
            const rgb = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
            const level = brightness / 100;
            let amount, towardWhite;
            if (level < 0.5) {
                amount = level <= 0.25 ? level / 0.25 * 0.5 : 0.5 + (level - 0.25) / 0.25 * 0.5;
                towardWhite = false;
            } else {
                amount = (level - 0.5) / 0.5;
                towardWhite = true;
            }
            const background = rgb.map(channel => Math.round(towardWhite
                ? channel + (255 - channel) * amount
                : channel * amount));
            return `rgba(${background.join(', ')}, ${opacity})`;
        }
        function applyLyricsTagStyle(tag, label, style = getLyricsTagStyle(label)) {
            tag.dataset.label = label;
            tag.style.setProperty('--tag-color', style.color);
            tag.style.setProperty('--tag-fill', getLyricsTagBackground(style.color, lyricsTagBrightness, lyricsTagOpacity));
        }
        const lyricsParenthesesStyles = new Map();
        const lyricsCheckpointMarkers = new Map();
        const compactLyricsCheckpointMarkers = new Map();
        function getLyricsParenthesesStyle(label) {
            if (!lyricsParenthesesStyles.has(label)) {
                lyricsParenthesesStyles.set(label, { background: '#000000', color: '#ffffff', opacity: 0.5 });
            }
            return lyricsParenthesesStyles.get(label);
        }
        function applyLyricsParenthesesStyle(tag, label, style = getLyricsParenthesesStyle(label)) {
            tag.dataset.parenthesesLabel = label;
            tag.style.backgroundColor = style.background;
            tag.style.color = style.color;
            tag.style.opacity = style.opacity;
        }
        function appendLyricsText(group, line) {
            const tagPattern = /\[([^\[\]\r\n]+)\]|\(([^()\r\n]+)\)|\*\*([^*()\[\]\r\n]+)\*\*|\*([^*()\[\]\r\n]+)\*/g;
            let lastIndex = 0;
            let match;
            while ((match = tagPattern.exec(line)) !== null) {
                if (match.index > lastIndex) group.appendChild(document.createTextNode(line.slice(lastIndex, match.index)));
                const tag = document.createElement('span');
                if (match[1] !== undefined) {
                    const label = match[1].toLocaleUpperCase('es');
                    tag.className = 'lyrics-tag';
                    tag.textContent = label;
                    applyLyricsTagStyle(tag, label);
                } else if (match[2] !== undefined) {
                    tag.className = 'lyrics-parentheses-tag';
                    tag.textContent = match[2];
                    applyLyricsParenthesesStyle(tag, match[2]);
                } else if (match[3] !== undefined) {
                    tag.className = 'lyrics-bold';
                    tag.textContent = match[3];
                } else {
                    tag.className = 'lyrics-italic';
                    tag.textContent = match[4];
                }
                group.appendChild(tag);
                lastIndex = tagPattern.lastIndex;
            }
            if (lastIndex < line.length) group.appendChild(document.createTextNode(line.slice(lastIndex)));
        }
        function hasLyricsPlainText(line) {
            return line.replace(/\[[^\[\]\r\n]+\]|\([^()\r\n]+\)/g, '').trim().length > 0;
        }
        function appendLyricsVisualRow(group, line) {
            const row = document.createElement('div');
            row.className = 'lyrics-visual-row';
            appendLyricsText(row, line);
            group.appendChild(row);
        }
        function createEmptyLyricsGroup(sourceRow) {
            const group = document.createElement('div');
            group.className = 'lyrics-line';
            const row = document.createElement('div');
            row.className = 'lyrics-visual-row';
            row.setAttribute('aria-hidden', 'true');
            group.appendChild(row);
            lyricsLineGroups.push(group);
            lyricsGroupSourceRows.push(sourceRow);
            lyricsLinesTrack.appendChild(group);
        }
        function updateLyricsLinePosition() {
            if (!lyricsLineGroups.length) return;
            const compactVisible = getComputedStyle(compactAudioFrame).display !== 'none';
            const activeLine = compactVisible
                ? compactLyricsTrack.querySelectorAll('.lyrics-line')[activeLyricsLine]
                : lyricsLineGroups[activeLyricsLine];
            if (!activeLine) return;
            const lineCenter = activeLine.offsetTop + activeLine.offsetHeight / 2;
            const transform = `translateY(${-lineCenter}px)`;
            lyricsLinesTrack.style.transform = transform;
            compactLyricsTrack.style.transform = transform;
        }
        function syncCompactLyricsTrack() {
            compactLyricsTrack.innerHTML = lyricsLinesTrack.innerHTML;
            compactLyricsTrack.style.transform = lyricsLinesTrack.style.transform;
        }
        function setActiveLyricsLine(nextLine) {
            if (!lyricsLineGroups.length) return;
            const clampedLine = Math.max(0, Math.min(lyricsLineGroups.length - 1, nextLine));
            if (clampedLine === activeLyricsLine) return;
            lyricsLineGroups[activeLyricsLine]?.classList.remove('active');
            compactLyricsTrack.querySelectorAll('.lyrics-line')[activeLyricsLine]?.classList.remove('active');
            activeLyricsLine = clampedLine;
            lyricsLineGroups[activeLyricsLine].classList.add('active');
            compactLyricsTrack.querySelectorAll('.lyrics-line')[activeLyricsLine]?.classList.add('active');
            updateLyricsLinePosition();
        }
        function recordLyricsCheckpoint(sourceRow) {
            const time = Math.round((audioElement.currentTime || 0) * 100) / 100;
            const existing = lyricsCheckpoints.findIndex(checkpoint => checkpoint.time === time);
            if (existing >= 0) {
                lyricsCheckpoints[existing].row = sourceRow;
                lyricsCheckpoints[existing].explicit = true;
            } else lyricsCheckpoints.push({ time, row: sourceRow, explicit: true });
            lyricsCheckpoints.sort((a, b) => a.time - b.time);
            selectedLyricsCheckpointTime = time;
            renderLyricsCheckpointMarkers();
        }
        function renderLyricsCheckpointMarkers() {
            if (!audioElement.duration || !Number.isFinite(audioElement.duration)) {
                seekbarCheckpoints.replaceChildren();
                compactSeekbarCheckpoints.replaceChildren();
                lyricsCheckpointMarkers.clear();
                compactLyricsCheckpointMarkers.clear();
                return;
            }
            const visibleCheckpoints = lyricsCheckpoints.filter(checkpoint => checkpoint.time > 0 || checkpoint.explicit);
            const retainedTimes = new Set(visibleCheckpoints.map(checkpoint => checkpoint.time));
            for (const [time, marker] of lyricsCheckpointMarkers) {
                if (!retainedTimes.has(time)) {
                    marker.remove();
                    lyricsCheckpointMarkers.delete(time);
                }
            }
            for (const [time, marker] of compactLyricsCheckpointMarkers) {
                if (!retainedTimes.has(time)) {
                    marker.remove();
                    compactLyricsCheckpointMarkers.delete(time);
                }
            }
            const markerWidth = 30;
            let previousPosition = null;
            let previousBelow = false;
            const compactMarkerWidth = Math.max(12, window.innerWidth * 0.085 * 0.24);
            let previousCompactPosition = null;
            let previousCompactBelow = false;
            for (const checkpoint of visibleCheckpoints) {
                let marker = lyricsCheckpointMarkers.get(checkpoint.time);
                if (!marker) {
                    marker = document.createElement('span');
                    marker.className = 'seekbar-checkpoint-marker';
                    marker.innerHTML = '<span class="seekbar-checkpoint-glyph"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 C10.1 2 4 9.3 4 18 C4 27.1 15.1 36.2 19 39 C19.6 39.5 20.4 39.5 21 39 C24.9 36.2 36 27.1 36 18 C36 9.3 29.9 2 20 2 Z" fill="currentColor"></path></svg></span>';
                    marker.dataset.time = String(checkpoint.time);
                    lyricsCheckpointMarkers.set(checkpoint.time, marker);
                }
                if (marker.parentElement !== seekbarCheckpoints) seekbarCheckpoints.appendChild(marker);
                marker.classList.toggle('selected', checkpoint.time === selectedLyricsCheckpointTime);
                const percentage = Math.max(0, Math.min(100, checkpoint.time / audioElement.duration * 100));
                const position = percentage * seekbarTrack.clientWidth / 100;
                const overlapsPrevious = previousPosition !== null && position - previousPosition < markerWidth;
                const below = overlapsPrevious && !previousBelow;
                marker.classList.toggle('below', below);
                marker.style.left = `${percentage}%`;
                previousPosition = position;
                previousBelow = below;

                let compactMarker = compactLyricsCheckpointMarkers.get(checkpoint.time);
                if (!compactMarker) {
                    compactMarker = document.createElement('span');
                    compactMarker.className = 'compact-seekbar-checkpoint-marker';
                    compactMarker.innerHTML = '<span class="seekbar-checkpoint-glyph"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 C10.1 2 4 9.3 4 18 C4 27.1 15.1 36.2 19 39 C19.6 39.5 20.4 39.5 21 39 C24.9 36.2 36 27.1 36 18 C36 9.3 29.9 2 20 2 Z" fill="currentColor"></path></svg></span>';
                    compactMarker.dataset.time = String(checkpoint.time);
                    compactLyricsCheckpointMarkers.set(checkpoint.time, compactMarker);
                }
                if (compactMarker.parentElement !== compactSeekbarCheckpoints) compactSeekbarCheckpoints.appendChild(compactMarker);
                compactMarker.classList.toggle('selected', checkpoint.time === selectedLyricsCheckpointTime);
                const compactPosition = percentage * compactSeekbarTrack.clientWidth / 100;
                const compactOverlapsPrevious = previousCompactPosition !== null && compactPosition - previousCompactPosition < compactMarkerWidth;
                const compactBelow = compactOverlapsPrevious && !previousCompactBelow;
                compactMarker.classList.toggle('below', compactBelow);
                compactMarker.style.left = `${percentage}%`;
                previousCompactPosition = compactPosition;
                previousCompactBelow = compactBelow;
            }
        }
        window.addEventListener('resize', renderLyricsCheckpointMarkers);
        function restoreLyricsCheckpointState(checkpoints, selectedTime) {
            lyricsCheckpoints = checkpoints.map(checkpoint => ({ ...checkpoint }));
            selectedLyricsCheckpointTime = selectedTime;
            renderLyricsCheckpointMarkers();
            syncCompactLyricsTrack();
            updateLyricsFromAudioTime();
        }
        function selectLyricsCheckpoint(time) {
            const previousMarker = lyricsCheckpointMarkers.get(selectedLyricsCheckpointTime);
            previousMarker?.classList.remove('selected');
            compactLyricsCheckpointMarkers.get(selectedLyricsCheckpointTime)?.classList.remove('selected');
            selectedLyricsCheckpointTime = time;
            lyricsCheckpointMarkers.get(time)?.classList.add('selected');
            compactLyricsCheckpointMarkers.get(time)?.classList.add('selected');
            if (!audioElement.duration) return;
            audioElement.currentTime = time;
            updateSliderPosition(time / audioElement.duration * 100);
            timeElapsedEl.textContent = formatTime(time);
            timeRemainingEl.textContent = formatTime(Math.max(0, audioElement.duration - time));
            updateLyricsFromAudioTime();
        }
        function updateLyricsFromAudioTime() {
            if (!lyricsLineGroups.length) return;
            const time = audioElement.currentTime || 0;
            let low = 0, high = lyricsCheckpoints.length;
            while (low < high) {
                const middle = (low + high) >>> 1;
                if (lyricsCheckpoints[middle].time <= time) low = middle + 1;
                else high = middle;
            }
            const sourceRow = low ? lyricsCheckpoints[low - 1].row : -1;
            let lineIndex = 0;
            for (let i = 0; i < lyricsGroupSourceRows.length; i++) {
                if (lyricsGroupSourceRows[i] > sourceRow) break;
                lineIndex = i;
            }
            setActiveLyricsLine(lineIndex);
        }
        function renderLyricsLines(text) {
            clearMovementHistory();
            lyricsLinesTrack.replaceChildren();
            lyricsLineGroups = [];
            lyricsGroupSourceRows = [];
            activeLyricsLine = 0;
            lyricsLinesTrack.style.transform = 'translateY(0px)';
            if (text.length) {
                const sourceLines = text.split(/\r\n|\r|\n/);
                createEmptyLyricsGroup(-1);
                let lineIndex = 0;
                while (lineIndex < sourceLines.length) {
                    const line = sourceLines[lineIndex];
                    if (!line.trim().length) {
                        const spacer = document.createElement('div');
                        spacer.className = 'lyrics-line-spacer';
                        lyricsLinesTrack.appendChild(spacer);
                        lineIndex++;
                        continue;
                    }
                    const group = document.createElement('div');
                    group.className = `lyrics-line${lyricsLineGroups.length === activeLyricsLine ? ' active' : ''}`;
                    const groupStartRow = lineIndex;
                    let rowIndex = lineIndex;
                    let currentLine = line;
                    let isFirstRow = true;

                    while (true) {
                        const explicitJoin = />[\t ]*$/.test(currentLine);
                        const displayLine = explicitJoin ? currentLine.replace(/>[\t ]*$/, '') : currentLine;
                        appendLyricsVisualRow(group, displayLine);

                        const nextLine = sourceLines[rowIndex + 1];
                        const bracketOnly = currentLine.trim().match(/^\[([^\[\]\r\n]+)\]$/);
                        const automaticJoin = isFirstRow && bracketOnly && nextLine !== undefined &&
                            nextLine.trim().length > 0 && hasLyricsPlainText(nextLine);
                        const shouldJoinNext = explicitJoin || automaticJoin;
                        if (!shouldJoinNext || nextLine === undefined || !nextLine.trim().length) break;

                        rowIndex++;
                        currentLine = sourceLines[rowIndex];
                        isFirstRow = false;
                    }

                    lyricsLineGroups.push(group);
                    lyricsGroupSourceRows.push(groupStartRow);
                    lyricsLinesTrack.appendChild(group);
                    lineIndex = rowIndex + 1;
                }
                createEmptyLyricsGroup(sourceLines.length);
            }
            syncCompactLyricsTrack();
            updateLyricsFromAudioTime();
            lyricsLinesTrack.style.transition = 'none';
            compactLyricsTrack.style.transition = 'none';
            requestAnimationFrame(() => {
                updateLyricsLinePosition();
                requestAnimationFrame(() => {
                    lyricsLinesTrack.style.transition = '';
                    compactLyricsTrack.style.transition = '';
                });
            });
            applyLyricsTextColor();
        }
        function moveActiveLyricsLine(direction) {
            const lines = lyricsLineGroups;
            if (!lines.length) return;
            const nextLine = Math.max(0, Math.min(lines.length - 1, activeLyricsLine + direction));
            if (nextLine === activeLyricsLine) return;
            const previousCheckpoints = lyricsCheckpoints.map(checkpoint => ({ ...checkpoint }));
            const previousSelectedTime = selectedLyricsCheckpointTime;
            setActiveLyricsLine(nextLine);
            recordLyricsCheckpoint(lyricsGroupSourceRows[nextLine]);
            const nextCheckpoints = lyricsCheckpoints.map(checkpoint => ({ ...checkpoint }));
            const nextSelectedTime = selectedLyricsCheckpointTime;
            recordMovement(
                () => restoreLyricsCheckpointState(previousCheckpoints, previousSelectedTime),
                () => restoreLyricsCheckpointState(nextCheckpoints, nextSelectedTime)
            );
        }
        lyricsMoveDownTrigger.addEventListener('click', () => moveActiveLyricsLine(1));
        lyricsUndoTrigger.addEventListener('click', undoMovement);
        function adjustLyricsFont(direction) {
            const currentScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lyrics-font-scale')) || 1;
            const nextScale = Math.max(0.1, Math.min(4, currentScale * (direction > 0 ? 1.1 : 0.9)));
            document.documentElement.style.setProperty('--lyrics-font-scale', String(nextScale));
            updateLyricsLinePosition();
        }
        lyricsFontIncrease.addEventListener('click', () => adjustLyricsFont(1));
        lyricsFontDecrease.addEventListener('click', () => adjustLyricsFont(-1));
        document.addEventListener('keydown', (e) => {
            const target = e.target;
            if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
            if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undoMovement();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redoMovement();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && audioElement.duration) {
                const direction = e.key === 'ArrowLeft' ? -1 : 1;
                const currentTime = audioElement.currentTime;
                const tolerance = 0.02;
                const candidates = lyricsCheckpoints
                    .filter(checkpoint => checkpoint.time > 0 && (direction < 0
                        ? checkpoint.time < currentTime - tolerance
                        : checkpoint.time > currentTime + tolerance));
                const target = direction < 0
                    ? candidates[candidates.length - 1]
                    : candidates[0];
                const checkpointOrEdge = target || { time: direction < 0 ? 0 : audioElement.duration };
                e.preventDefault();
                selectLyricsCheckpoint(checkpointOrEdge.time);
                return;
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLyricsCheckpointTime !== null) {
                const deletedTime = selectedLyricsCheckpointTime;
                const previousCheckpoints = lyricsCheckpoints.map(checkpoint => ({ ...checkpoint }));
                const index = lyricsCheckpoints.findIndex(checkpoint => checkpoint.time === deletedTime);
                if (index >= 0 && (deletedTime > 0 || lyricsCheckpoints[index].explicit)) {
                    e.preventDefault();
                    let previousSelectedTime = null;
                    for (let i = index - 1; i >= 0; i--) {
                        if (lyricsCheckpoints[i].time > 0 || lyricsCheckpoints[i].explicit) {
                            previousSelectedTime = lyricsCheckpoints[i].time;
                            break;
                        }
                    }
                    lyricsCheckpoints.splice(index, 1);
                    selectedLyricsCheckpointTime = previousSelectedTime;
                    const nextCheckpoints = lyricsCheckpoints.map(checkpoint => ({ ...checkpoint }));
                    renderLyricsCheckpointMarkers();
                    updateLyricsFromAudioTime();
                    recordMovement(
                        () => restoreLyricsCheckpointState(previousCheckpoints, deletedTime),
                        () => restoreLyricsCheckpointState(nextCheckpoints, previousSelectedTime)
                    );
                    return;
                }
            }
            const decreaseFont = e.key === '-' || e.code === 'NumpadSubtract';
            const increaseFont = e.key === '+' || (e.key === '=' && e.shiftKey) || e.code === 'NumpadAdd';
            if (decreaseFont || increaseFont) {
                e.preventDefault();
                adjustLyricsFont(increaseFont ? 1 : -1);
                return;
            }
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            if (!lyricsLineGroups.length) return;
            e.preventDefault();
            moveActiveLyricsLine(e.key === 'ArrowDown' ? 1 : -1);
        });
        let lyricsEditorCloseTimer = null;
        const openLyricsEditor = () => {
            clearTimeout(lyricsEditorCloseTimer);
            lyricsEditorBackdrop.classList.remove('hidden');
            syncLayerOpenState();
            lyricsEditorPanel.scrollTop = 0;
            lyricsEditorPanel.focus();
            void lyricsEditorBackdrop.offsetWidth;
            requestAnimationFrame(() => lyricsEditorBackdrop.classList.add('open'));
        };
        const updateLyricsEditorSide = () => {
            const leftSide = lyricsEditorBackdrop.classList.contains('left-side');
            lyricsEditorSideToggle.textContent = leftSide ? 'Derecha \u21cc' : '\u21cb Izquierda';
            lyricsEditorPanel.classList.toggle('left-scrollbar', leftSide);
            lyricsEditorResizeHandle.classList.toggle('left-edge', !leftSide);
            lyricsEditorResizeHandle.classList.toggle('right-edge', leftSide);
            lyricsEditorGuideLine.classList.toggle('left-edge', !leftSide);
            lyricsEditorGuideLine.classList.toggle('right-edge', leftSide);
            updateLyricsEditorGuide(latestLyricsPointer || { clientX: -1e6, clientY: -1e6 });
        };
        lyricsEditorSideToggle.addEventListener('click', () => {
            const startLeft = lyricsEditorPanelWrap.getBoundingClientRect().left;
            if (lyricsEditorSideAnimation) lyricsEditorSideAnimation.cancel();
            lyricsEditorBackdrop.classList.toggle('left-side');
            updateLyricsEditorSide();
            const distance = startLeft - lyricsEditorPanelWrap.getBoundingClientRect().left;
            lyricsEditorSideAnimation = lyricsEditorPanelWrap.animate(
                [{ transform: `translateX(${distance}px)` }, { transform: 'translateX(0)' }],
                {
                    duration: 420,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
                }
            );
            lyricsEditorSideAnimation.onfinish = () => { lyricsEditorSideAnimation = null; };
        });
        const closeLyricsEditor = () => {
            lyricsEditorBackdrop.classList.remove('open');
            const finishClose = () => {
                if (!lyricsEditorBackdrop.classList.contains('open')) {
                    lyricsEditorBackdrop.classList.add('hidden');
                    syncLayerOpenState();
                }
                clearTimeout(lyricsEditorCloseTimer);
            };
            const onPanelTransition = (e) => {
                if (e.target === lyricsEditorPanelWrap && e.propertyName === 'transform') {
                    lyricsEditorPanelWrap.removeEventListener('transitionend', onPanelTransition);
                    finishClose();
                }
            };
            lyricsEditorPanelWrap.addEventListener('transitionend', onPanelTransition);
            lyricsEditorCloseTimer = setTimeout(finishClose, 450);
        };
        lyricsEditorTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openLyricsEditor();
        });
        let lyricsSettingsMenuCloseTimer = null;
        let settingsBackdropCloseTimer=null;
        function showSettingsBackdrop() {
            clearTimeout(settingsBackdropCloseTimer);
            settingsBackdrop.classList.remove('hidden');
            syncLayerOpenState();
            void settingsBackdrop.offsetWidth;
            settingsBackdrop.classList.add('open');
        }
        function hideSettingsBackdrop() {
            if (document.querySelector('.settings-drawer.open')) return;
            settingsBackdrop.classList.remove('open');
            clearTimeout(settingsBackdropCloseTimer);
            settingsBackdropCloseTimer=setTimeout(()=>{
                if (!document.querySelector('.settings-drawer.open')) settingsBackdrop.classList.add('hidden');
                syncLayerOpenState();
            },220);
        }
        function syncLayerOpenState() {
            const layerOpen = !settingsBackdrop.classList.contains('hidden') || !lyricsEditorBackdrop.classList.contains('hidden');
            document.body.classList.toggle('layer-open', layerOpen);
        }
        function closeSettingsSectionsMenu({ preserveBackdrop = false } = {}) {
            settingsSectionsMenu.classList.remove('open');
            settingsTrigger.setAttribute('aria-expanded', 'false');
            if (!preserveBackdrop) hideSettingsBackdrop();
            setTimeout(() => { if (!settingsSectionsMenu.classList.contains('open')) settingsSectionsMenu.classList.add('hidden'); }, 400);
        }
        function openSettingsDrawer(menu) {
            menu.classList.remove('hidden');
            showSettingsBackdrop();
            void menu.offsetWidth;
            menu.classList.add('open');
        }
        function closeSettingsDrawer(menu, { preserveBackdrop = false } = {}) {
            menu.classList.remove('open');
            if (!preserveBackdrop) hideSettingsBackdrop();
            setTimeout(() => { if (!menu.classList.contains('open')) menu.classList.add('hidden'); }, 400);
        }
        function openSettingsHelpMenu() {
            closeSettingsSectionsMenu({ preserveBackdrop: true });
            openSettingsDrawer(settingsHelpMenu);
        }
        function openSettingsShortcutsMenu() {
            closeSettingsDrawer(settingsHelpMenu, { preserveBackdrop: true });
            openSettingsDrawer(settingsShortcutsMenu);
        }
        settingsHelpTrigger.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            openSettingsHelpMenu();
        });
        settingsShortcutsTrigger.addEventListener('click', () => openSettingsShortcutsMenu());
        document.getElementById('settings-help-back').addEventListener('click', () => {
            closeSettingsDrawer(settingsHelpMenu, { preserveBackdrop: true });
            openSettingsSectionsMenu();
        });
        document.getElementById('settings-shortcuts-back').addEventListener('click', () => {
            closeSettingsDrawer(settingsShortcutsMenu, { preserveBackdrop: true });
            openSettingsDrawer(settingsHelpMenu);
        });
        function openSettingsSectionsMenu() {
            settingsSectionsMenu.classList.remove('hidden');
            showSettingsBackdrop();
            void settingsSectionsMenu.offsetWidth;
            settingsSectionsMenu.classList.add('open');
            settingsTrigger.setAttribute('aria-expanded', 'true');
        }
        settingsTrigger.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            if (settingsSectionsMenu.classList.contains('open')) {
                closeSettingsSectionsMenu();
                return;
            }
            closeLyricsSettingsMenu();
            closeAudioSettingsMenu();
            closeCounterSettingsMenu();
            closeBackgroundSettingsMenu();
            closeManagementSettingsMenu();
            openSettingsSectionsMenu();
        });
        settingsSectionsMenu.addEventListener('click', e => {
            const section = e.target.closest('[data-settings-section]')?.dataset.settingsSection;
            if (!section) return;
            if (section === 'lyrics') openLyricsSettingsMenu();
            if (section === 'audio') openAudioSettingsMenu();
            if (section === 'counter') openCounterSettings();
            if (section === 'background') openBackgroundSettingsMenu();
            if (section === 'management') openManagementSettingsMenu();
            closeSettingsSectionsMenu({ preserveBackdrop: true });
        });
        settingsSectionsMenu.querySelector('.settings-sections-close').addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            closeSettingsSectionsMenu();
        });
        document.querySelectorAll('.settings-back-button').forEach(button => button.addEventListener('click', () => {
            if (button.closest('#settings-help-menu, #settings-shortcuts-menu')) return;
            closeLyricsSettingsMenu();
            closeAudioSettingsMenu();
            closeCounterSettingsMenu();
            closeBackgroundSettingsMenu();
            closeManagementSettingsMenu();
            openSettingsSectionsMenu();
        }));
        settingsBackdrop.addEventListener('click', () => {
            if (settingsShortcutsMenu.classList.contains('open')) closeSettingsDrawer(settingsShortcutsMenu);
            else if (settingsHelpMenu.classList.contains('open')) closeSettingsDrawer(settingsHelpMenu);
            else if (settingsSectionsMenu.classList.contains('open')) closeSettingsSectionsMenu();
            else if (managementSettingsMenu.classList.contains('open')) closeManagementSettingsMenu();
        });
        function closeLyricsSettingsMenu() {
            lyricsSettingsMenu.classList.remove('open');
            hideSettingsBackdrop();
            closeColorPicker();
            clearTimeout(lyricsSettingsMenuCloseTimer);
            lyricsSettingsMenuCloseTimer = setTimeout(() => {
                if (!lyricsSettingsMenu.classList.contains('open')) lyricsSettingsMenu.classList.add('hidden');
            }, 400);
        }
        function closeAudioSettingsMenu() {
            audioSettingsMenu.classList.remove('open');
            hideSettingsBackdrop();
            closeColorPicker();
            setTimeout(()=>{if(!audioSettingsMenu.classList.contains('open')) audioSettingsMenu.classList.add('hidden');},400);
        }
        let counterSettingsCloseTimer=null;
        function closeCounterSettingsMenu() {
            counterSettingsMenu.classList.remove('open');
            hideSettingsBackdrop();
            closeColorPicker();
            clearTimeout(counterSettingsCloseTimer);
            counterSettingsCloseTimer=setTimeout(()=>{
                if (!counterSettingsMenu.classList.contains('open')) counterSettingsMenu.classList.add('hidden');
            },400);
        }
        let backgroundSettingsCloseTimer=null;
        function closeBackgroundSettingsMenu() {
            backgroundSettingsMenu.classList.remove('open');
            hideSettingsBackdrop();
            closeColorPicker();
            clearTimeout(backgroundSettingsCloseTimer);
            backgroundSettingsCloseTimer=setTimeout(()=>{
                if (!backgroundSettingsMenu.classList.contains('open')) backgroundSettingsMenu.classList.add('hidden');
            },400);
        }
        let managementSettingsCloseTimer=null;
        function closeManagementSettingsMenu() {
            managementSettingsMenu.classList.remove('open');
            hideSettingsBackdrop();
            clearTimeout(managementSettingsCloseTimer);
            managementSettingsCloseTimer=setTimeout(()=>{
                if (!managementSettingsMenu.classList.contains('open')) managementSettingsMenu.classList.add('hidden');
            },400);
        }
        function openManagementSettingsMenu() {
            if (managementSettingsMenu.classList.contains('open')) {
                closeManagementSettingsMenu();
                return;
            }
            closeLyricsSettingsMenu();
            closeAudioSettingsMenu();
            closeCounterSettingsMenu();
            closeBackgroundSettingsMenu();
            clearTimeout(managementSettingsCloseTimer);
            managementSettingsMenu.classList.remove('hidden');
            showSettingsBackdrop();
            void managementSettingsMenu.offsetWidth;
            requestAnimationFrame(()=>managementSettingsMenu.classList.add('open'));
        }
        function applyBackgroundFill() {
            const gradient=currentBackgroundColors.length>1
                ? `linear-gradient(to bottom right, ${currentBackgroundColors.map((color,index)=>`${color} ${index/(currentBackgroundColors.length-1)*100}%`).join(', ')})`
                : 'none';
            for (const element of [document.documentElement,document.body]) {
                element.style.backgroundColor=currentBackgroundColors[0];
                element.style.backgroundImage=gradient;
            }
            backgroundColorAdd.hidden=currentBackgroundColors.length>=3;
            const fileMode=currentBackgroundMode==='image'||currentBackgroundMode==='video';
            backgroundModeToggle.textContent=`Modo: ${currentBackgroundMode==='color'?'Color':currentBackgroundMode==='video'?'Video':'Imagen'}`;
            backgroundModeToggle.dataset.mode=currentBackgroundMode;
            backgroundModeToggle.setAttribute('aria-pressed',String(fileMode));
            backgroundSyncButton.innerHTML=fileMode?uploadIconSvg:syncIconSvg;
            backgroundSyncButton.setAttribute('aria-label',fileMode?'Cargar archivo':'Sincronizar colores');
            backgroundSyncButton.title=fileMode?'Cargar archivo':'Sincronizar colores';
            backgroundColorControls.classList.toggle('hidden',currentBackgroundMode!=='color');
            backgroundImageControls.classList.toggle('hidden',!fileMode);
            backgroundImageFileInput.accept=currentBackgroundMode==='video'?'video/*':'image/*';
            const showImage=currentBackgroundMode==='image'&&!!currentBackgroundImageUrl;
            const showVideo=currentBackgroundMode==='video'&&!!currentBackgroundVideoUrl;
            backgroundImageBlur.classList.toggle('hidden',!showImage&&!showVideo);
            backgroundImageBlurLabel.classList.toggle('hidden',!showImage&&!showVideo);
            backgroundVideoControls.classList.toggle('hidden',!showVideo);
            backgroundImageLayer.style.backgroundImage=showImage?`url("${currentBackgroundImageUrl}")`:'none';
            backgroundImageLayer.style.display=showImage?'block':'none';
            backgroundVideoLayer.style.display=showVideo?'block':'none';
            if (showVideo && backgroundVideoLayer.src!==currentBackgroundVideoUrl) { backgroundVideoLayer.src=currentBackgroundVideoUrl; backgroundVideoLayer.play().catch(()=>{}); }
            if (!showVideo && backgroundVideoLayer.src) { backgroundVideoLayer.pause(); backgroundVideoLayer.removeAttribute('src'); backgroundVideoLayer.load(); }
            syncBackgroundVideoControls();
        }
        function setBackgroundMode(mode) {
            if (currentBackgroundMode!==mode && currentBackgroundVideoUrl) {
                URL.revokeObjectURL(currentBackgroundVideoUrl);
                currentBackgroundVideoUrl='';
            }
            currentBackgroundMode=mode;
            applyBackgroundFill();
        }
        function syncBackgroundVideoControls() {
            const videoPaused=backgroundVideoLayer.paused;
            backgroundVideoPauseIcon.classList.toggle('hidden',videoPaused);
            backgroundVideoPlayIcon.classList.toggle('hidden',!videoPaused);
            backgroundVideoToggle.setAttribute('aria-label',videoPaused?'Reanudar video de fondo':'Pausar video de fondo');
            backgroundVideoToggle.title=videoPaused?'Reanudar video de fondo':'Pausar video de fondo';
            const duration=backgroundVideoLayer.duration;
            const enabled=currentBackgroundMode==='video'&&Number.isFinite(duration)&&duration>0;
            const progress=enabled?Math.max(0,Math.min(1,backgroundVideoLayer.currentTime/duration)):0;
            backgroundVideoSeekbar.disabled=!enabled;
            backgroundVideoSeekbar.value=String(Math.round(progress*1000));
            backgroundVideoSeekbar.style.setProperty('--background-video-progress',`${progress*100}%`);
        }
        backgroundVideoToggle.addEventListener('click',()=>{
            if (backgroundVideoLayer.paused) backgroundVideoLayer.play().catch(()=>{});
            else backgroundVideoLayer.pause();
        });
        backgroundVideoSeekbar.addEventListener('input',()=>{
            if (Number.isFinite(backgroundVideoLayer.duration)&&backgroundVideoLayer.duration>0) backgroundVideoLayer.currentTime=Number(backgroundVideoSeekbar.value)/1000*backgroundVideoLayer.duration;
            syncBackgroundVideoControls();
        });
        ['loadedmetadata','timeupdate','play','pause','durationchange'].forEach(eventName=>backgroundVideoLayer.addEventListener(eventName,()=>{
            syncBackgroundVideoControls();
        }));
        backgroundModeToggle.addEventListener('click',()=>{
            setBackgroundMode(currentBackgroundMode==='color'?'image':'color');
        });
        backgroundImageFileInput.addEventListener('change',()=>{
            const file=backgroundImageFileInput.files?.[0];
            if (!file || (currentBackgroundMode==='image'&&!file.type.startsWith('image/')) || (currentBackgroundMode==='video'&&!file.type.startsWith('video/')) || currentBackgroundMode==='color') return;
            if (file.type.startsWith('video/')) {
                if (currentBackgroundVideoUrl) URL.revokeObjectURL(currentBackgroundVideoUrl);
                currentBackgroundVideoUrl=URL.createObjectURL(file);
                currentBackgroundMode='video';
            } else {
                if (currentBackgroundImageUrl) URL.revokeObjectURL(currentBackgroundImageUrl);
                currentBackgroundImageUrl=URL.createObjectURL(file);
                currentBackgroundMode='image';
            }
            applyBackgroundFill();
            backgroundImageFileInput.value='';
        });
        backgroundImageBlur.addEventListener('input',()=>{
            document.documentElement.style.setProperty('--background-image-blur',`${backgroundImageBlur.value}px`);
        });
        window.addEventListener('beforeunload',()=>{
            if (currentBackgroundImageUrl) URL.revokeObjectURL(currentBackgroundImageUrl);
            if (currentBackgroundVideoUrl) URL.revokeObjectURL(currentBackgroundVideoUrl);
            if (audioFrameImageState.url) URL.revokeObjectURL(audioFrameImageState.url);
            if (lyricsFrameImageState.url) URL.revokeObjectURL(lyricsFrameImageState.url);
        });
        function updateBackgroundColorIndexes() {
            [...backgroundColorSwatches.querySelectorAll('button')].forEach((button,index)=>{
                button.dataset.colorIndex=String(index);
                button.setAttribute('aria-label',index?'Elegir color de fondo '+(index+1):'Color principal del fondo');
                button.title=index?'Color '+(index+1):'Color principal';
            });
            currentBackgroundColors=[...backgroundColorSwatches.querySelectorAll('button')].map(button=>button.dataset.color);
            applyBackgroundFill();
        }
        function openBackgroundSettingsMenu() {
            if (backgroundSettingsMenu.classList.contains('open')) {
                closeBackgroundSettingsMenu();
                return;
            }
            closeLyricsSettingsMenu();
            closeAudioSettingsMenu();
            closeCounterSettingsMenu();
            clearTimeout(backgroundSettingsCloseTimer);
            backgroundSettingsMenu.classList.remove('hidden');
            showSettingsBackdrop();
            void backgroundSettingsMenu.offsetWidth;
            requestAnimationFrame(()=>backgroundSettingsMenu.classList.add('open'));
        }
        backgroundColorSwatches.addEventListener('click',e=>{
            const button=e.target.closest('button[data-color-index]');
            if (!button) return;
            e.stopPropagation();
            if (lyricsColorPicker.classList.contains('open') && activeColorPickerOptions?.anchor===button) {
                closeColorPicker();
                return;
            }
            const index=Number(button.dataset.colorIndex);
            openColorPicker({
                anchor:button,preview:button,color:currentBackgroundColors[index],resetColor:currentBackgroundColors[index],showOpacity:false,
                onChange:color=>{currentBackgroundColors[index]=color.toLowerCase();button.dataset.color=color.toLowerCase();button.style.backgroundColor=color;applyBackgroundFill();},
                onDelete:currentBackgroundColors.length>1?()=>{button.remove();updateBackgroundColorIndexes();closeColorPicker();}:null
            });
        });
        backgroundColorAdd.addEventListener('click',e=>{
            e.stopPropagation();
            if (currentBackgroundColors.length>=3) return;
            const button=document.createElement('button');
            button.type='button'; button.className='color-choice-button'; button.dataset.color='#ffffff'; button.style.backgroundColor='#ffffff';
            backgroundColorSwatches.append(button);
            updateBackgroundColorIndexes();
        });
        applyBackgroundFill();
        function applyCounterPillColor(color=currentCounterColor,opacity=currentCounterOpacity) {
            const r=parseInt(color.slice(1,3),16),g=parseInt(color.slice(3,5),16),b=parseInt(color.slice(5,7),16);
            const value=`rgba(${r},${g},${b},${opacity})`;
            [timeElapsedEl,timeRemainingEl,compactTimeElapsedEl,compactTimeRemainingEl,pillControls,compactPlaybackPill].forEach(element=>element.style.setProperty('--counter-pill-color',value));
            counterColorTrigger.style.backgroundColor=value;
        }
        function syncProgressColorButtons() {
            [...progressColorSwatches.querySelectorAll('button[data-color-index]')].forEach((button,index)=>{
                button.dataset.colorIndex=String(index);
                button.dataset.color=currentProgressColors[index];
                button.style.backgroundColor=currentProgressColors[index];
                button.setAttribute('aria-label',index?'Elegir segundo color del progreso':'Elegir color del progreso reproducido');
                button.title=index?'Segundo color de la barra':'Color de barra';
            });
            progressColorAdd.hidden=currentProgressColors.length>=2;
        }
        function applyProgressColors() {
            seekbarFill.style.backgroundColor=currentProgressColors[0];
            seekbarFill.style.backgroundImage=currentProgressColors.length>1
                ? `linear-gradient(to right, ${currentProgressColors[0]}, ${currentProgressColors[1]})`
                : 'none';
            compactSeekbarFill.style.backgroundColor=seekbarFill.style.backgroundColor;
            compactSeekbarFill.style.backgroundImage=seekbarFill.style.backgroundImage;
            syncProgressColorButtons();
        }
        function applyProgressTrackMode() {
            const color=currentProgressTrackMode==='dark'?'rgba(255,255,255,.25)':'rgba(0,0,0,.25)';
            seekbarTrack.style.backgroundColor=color;
            compactSeekbarTrack.style.backgroundColor=color;
            progressTrackModeToggle.textContent=currentProgressTrackMode==='dark'?'Oscuro':'Claro';
            progressTrackModeToggle.setAttribute('aria-pressed',String(currentProgressTrackMode==='light'));
            progressTrackModeToggle.setAttribute('aria-label',`Modo ${currentProgressTrackMode} de la barra restante. Cambiar modo`);
        }
        progressTrackModeToggle.addEventListener('click',e=>{
            e.stopPropagation();
            currentProgressTrackMode=currentProgressTrackMode==='dark'?'light':'dark';
            applyProgressTrackMode();
        });
        progressColorSwatches.addEventListener('click',e=>{
            const button=e.target.closest('button[data-color-index]');
            if (!button) return;
            e.stopPropagation();
            if (lyricsColorPicker.classList.contains('open') && activeColorPickerOptions?.anchor===button) { closeColorPicker(); return; }
            const index=Number(button.dataset.colorIndex);
            openColorPicker({
                anchor:button,preview:button,color:currentProgressColors[index],resetColor:currentProgressColors[index],showOpacity:false,
                onChange:color=>{currentProgressColors[index]=color.toLowerCase();applyProgressColors();},
                onDelete:currentProgressColors.length>1?()=>{currentProgressColors.splice(index,1);button.remove();applyProgressColors();closeColorPicker();}:null
            });
        });
        progressColorAdd.addEventListener('click',e=>{
            e.stopPropagation();
            if (currentProgressColors.length>=2) return;
            const button=document.createElement('button');
            button.type='button';button.className='color-choice-button';button.dataset.colorIndex=String(currentProgressColors.length);button.dataset.color='#ffffff';
            currentProgressColors.push('#ffffff');
            progressColorSwatches.append(button);
            applyProgressColors();
        });
        counterThumbColorTrigger.addEventListener('click',e=>{
            e.stopPropagation();
            if (lyricsColorPicker.classList.contains('open') && activeColorPickerOptions?.anchor===counterThumbColorTrigger) { closeColorPicker(); return; }
            openColorPicker({anchor:counterThumbColorTrigger,preview:counterThumbColorTrigger,color:currentCounterThumbColor,resetColor:currentCounterThumbColor,showOpacity:false,onChange:color=>{
                currentCounterThumbColor=color.toLowerCase();
                seekbarThumb.style.backgroundColor=currentCounterThumbColor;
                compactSeekbarThumb.style.backgroundColor=currentCounterThumbColor;
                counterThumbColorTrigger.style.backgroundColor=currentCounterThumbColor;
            }});
        });
        counterThumbToggle.addEventListener('click',e=>{
            e.stopPropagation();
            currentCounterThumbVisible=!currentCounterThumbVisible;
            counterThumbColorTrigger.classList.toggle('hidden',!currentCounterThumbVisible);
            seekbarThumb.hidden=!currentCounterThumbVisible;
            seekbarThumb.style.display=currentCounterThumbVisible?'':'none';
            compactSeekbarThumb.style.display=currentCounterThumbVisible?'':'none';
            counterThumbToggle.textContent=currentCounterThumbVisible?'Visible':'Oculto';
            counterThumbToggle.setAttribute('aria-pressed',String(currentCounterThumbVisible));
            counterThumbToggle.setAttribute('aria-label',currentCounterThumbVisible?'Ocultar thumb de la barra de progreso':'Mostrar thumb de la barra de progreso');
        });
        applyProgressColors();
        applyProgressTrackMode();
        seekbarThumb.style.backgroundColor=currentCounterThumbColor;
        compactSeekbarThumb.style.backgroundColor=currentCounterThumbColor;
        function openCounterSettings() {
            if (!counterSettingsMenu.classList.contains('hidden')) {
                closeCounterSettingsMenu();
                return;
            }
            closeBackgroundSettingsMenu();
            closeLyricsSettingsMenu();
            closeAudioSettingsMenu();
            closeCounterSettingsMenu();
            clearTimeout(counterSettingsCloseTimer);
            counterSettingsMenu.classList.remove('hidden');
            counterSettingsMenu.classList.remove('open');
            showSettingsBackdrop();
            void counterSettingsMenu.offsetWidth;
            requestAnimationFrame(()=>counterSettingsMenu.classList.add('open'));
        }
        [timeElapsedEl,timeRemainingEl].forEach(counter=>counter.addEventListener('click',e=>{
            e.preventDefault();
            e.stopPropagation();
            if (pillDragMoved) {
                pillDragMoved=false;
                clearTimeout(pillDragClickResetTimer);
                return;
            }
            openCounterSettings();
        }));
        [compactTimeElapsedEl,compactTimeRemainingEl].forEach(counter=>counter.addEventListener('click',e=>{
            e.preventDefault();
            e.stopPropagation();
            openCounterSettings();
        }));
        counterColorTrigger.addEventListener('click',e=>{
            e.stopPropagation();
            if (lyricsColorPicker.classList.contains('open') && activeColorPickerOptions?.anchor===counterColorTrigger) {
                closeColorPicker();
                return;
            }
            openColorPicker({
                anchor:counterColorTrigger,preview:counterColorTrigger,color:currentCounterColor,opacity:currentCounterOpacity,
                resetColor:currentCounterColor,resetOpacity:currentCounterOpacity,showOpacity:true,
                onChange:(color,opacity)=>{currentCounterColor=color.toLowerCase();currentCounterOpacity=opacity;applyCounterPillColor();}
            });
        });
        applyCounterPillColor();
        function applyAudioTextColor(color=currentAudioTextColor) {
            currentAudioTextColor=color.toLowerCase();
            [addedTextTop,addedTextBottom,addedTextRightTop,addedTextRightBottom,compactAddedTextTop,compactAddedTextBottom,compactAddedTextRightTop,compactAddedTextRightBottom].forEach(element=>element.style.color=currentAudioTextColor);
            audioTextColorTrigger.style.backgroundColor=currentAudioTextColor;
        }
        function applyAudioIconColor(color=currentAudioIconColor) {
            currentAudioIconColor=color.toLowerCase();
            [btnPlayPause,btnRewind10,btnForward10,compactRewindButton,compactForwardButton].forEach(element=>element.style.setProperty('--audio-icon-color',currentAudioIconColor));
            compactPlayPauseButton.style.setProperty('--audio-icon-color',currentAudioIconColor);
            [timeElapsedEl,timeRemainingEl,compactTimeElapsedEl,compactTimeRemainingEl].forEach(element=>element.style.color=currentAudioIconColor);
            audioIconColorTrigger.style.backgroundColor=currentAudioIconColor;
        }
        function applyPlayButtonCircle() {
            btnPlayPause.style.backgroundColor=playButtonCircleVisible?currentPlayButtonCircleColor:'transparent';
            btnPlayPause.style.borderColor=playButtonCircleVisible?'rgba(255,255,255,.1)':'transparent';
            compactPlayPauseButton.style.backgroundColor=playButtonCircleVisible?currentPlayButtonCircleColor:'transparent';
            compactPlayPauseButton.style.borderColor=playButtonCircleVisible?'rgba(255,255,255,.1)':'transparent';
            playButtonCircleColorTrigger.classList.toggle('hidden',!playButtonCircleVisible);
            const playButtonEffectRow=playButtonShadowLightToggle.closest('ul');
            playButtonEffectRow?.classList.toggle('hidden',!playButtonCircleVisible);
            playButtonEffectRow?.previousElementSibling?.classList.toggle('hidden',!playButtonCircleVisible);
            playButtonCircleColorTrigger.style.backgroundColor=currentPlayButtonCircleColor;
            playButtonCircleToggle.textContent=playButtonCircleVisible?'Visible':'Oculto';
            playButtonCircleToggle.setAttribute('aria-pressed',String(playButtonCircleVisible));
            playButtonCircleToggle.setAttribute('aria-label',playButtonCircleVisible?'Ocultar circulo del boton de reproduccion':'Mostrar circulo del boton de reproduccion');
            const scale=playButtonCircleVisible?1:1.2;
            const root=document.documentElement.style;
            root.setProperty('--playback-pill-width',String(1.1*scale));
            root.setProperty('--playback-pill-height',String(0.25*scale));
            root.setProperty('--playback-pill-padding',String(0.08*scale));
            root.setProperty('--playback-pill-button-size',String(0.22*scale));
            root.setProperty('--playback-icon-size',playButtonCircleVisible?'0.15':'0.18');
            root.setProperty('--counter-pill-width',String(0.55*scale));
            root.setProperty('--counter-pill-height',String(0.25*scale));
        }
        function applyLyricsTextColor(color=currentLyricsTextColor) {
            currentLyricsTextColor=color.toLowerCase();
            cuadroDeLetras.querySelectorAll('.lyrics-visual-row').forEach(row=>row.style.color=currentLyricsTextColor);
            compactAudioFrame.querySelectorAll('.lyrics-visual-row').forEach(row=>row.style.color=currentLyricsTextColor);
            lyricsTextColorTrigger.style.backgroundColor=currentLyricsTextColor;
        }
        function bindSimpleTextColorPicker(trigger,getColor,setColor,apply) {
            trigger.addEventListener('click',e=>{
                e.stopPropagation();
                if (lyricsColorPicker.classList.contains('open') && activeColorPickerOptions?.anchor===trigger) { closeColorPicker(); return; }
                openColorPicker({anchor:trigger,preview:trigger,color:getColor(),resetColor:getColor(),showOpacity:false,onChange:color=>{setColor(color.toLowerCase());apply();}});
            });
        }
        bindSimpleTextColorPicker(audioTextColorTrigger,()=>currentAudioTextColor,value=>{currentAudioTextColor=value;},applyAudioTextColor);
        bindSimpleTextColorPicker(audioIconColorTrigger,()=>currentAudioIconColor,value=>{currentAudioIconColor=value;},applyAudioIconColor);
        bindSimpleTextColorPicker(playButtonCircleColorTrigger,()=>currentPlayButtonCircleColor,value=>{currentPlayButtonCircleColor=value;},applyPlayButtonCircle);
        playButtonCircleToggle.addEventListener('click',e=>{
            e.stopPropagation();
            playButtonCircleVisible=!playButtonCircleVisible;
            applyPlayButtonCircle();
            applyPlayButtonShadowOrGlow();
        });
        bindSimpleTextColorPicker(lyricsTextColorTrigger,()=>currentLyricsTextColor,value=>{currentLyricsTextColor=value;},applyLyricsTextColor);
        bindSimpleTextColorPicker(lyricsParenthesesBackground,
            ()=>getLyricsParenthesesStyle(activeParenthesesLabel).background,
            color=>{getLyricsParenthesesStyle(activeParenthesesLabel).background=color;},
            ()=>{lyricsParenthesesBackground.style.backgroundColor=getLyricsParenthesesStyle(activeParenthesesLabel).background;updateParenthesesTagStyle('background',getLyricsParenthesesStyle(activeParenthesesLabel).background);}
        );
        bindSimpleTextColorPicker(lyricsParenthesesText,
            ()=>getLyricsParenthesesStyle(activeParenthesesLabel).color,
            color=>{getLyricsParenthesesStyle(activeParenthesesLabel).color=color;},
            ()=>{lyricsParenthesesText.style.backgroundColor=getLyricsParenthesesStyle(activeParenthesesLabel).color;updateParenthesesTagStyle('color',getLyricsParenthesesStyle(activeParenthesesLabel).color);}
        );
        applyAudioTextColor();
        applyAudioIconColor();
        applyPlayButtonCircle();
        function openLyricsSettingsMenu() {
            closeBackgroundSettingsMenu();
            closeCounterSettingsMenu();
            closeAudioSettingsMenu();
            clearTimeout(lyricsSettingsMenuCloseTimer);
            const rgb = getComputedStyle(cuadroDeLetras).backgroundColor.match(/[\d.]+/g);
            const current = rgb?.length >= 3 ? `#${rgb.slice(0, 3).map(value => Math.round(Number(value)).toString(16).padStart(2, '0')).join('')}` : '#202020';
            currentLyricsColor = current;
            currentLyricsColors[0] = current;
            currentLyricsOpacity = rgb?.length >= 4 ? Number(rgb[3]) : 1;
            lyricsFillOpacity.value=String(Math.round(currentLyricsOpacity*100));
            pickerOriginal = current;
            const primaryButton=lyricsColorSwatches.querySelector('button[data-color-index="0"]');
            primaryButton.dataset.color=current.toLowerCase();
            primaryButton.style.backgroundColor=`rgba(${Math.round(Number(rgb?.[0] ?? 32))}, ${Math.round(Number(rgb?.[1] ?? 32))}, ${Math.round(Number(rgb?.[2] ?? 32))}, ${currentLyricsOpacity})`;
            lyricsColorHex.value = current;
            lyricsSettingsMenu.classList.remove('hidden');
            showSettingsBackdrop();
            void lyricsSettingsMenu.offsetWidth;
            requestAnimationFrame(() => lyricsSettingsMenu.classList.add('open'));
        }
        function openAudioSettingsMenu() {
            closeBackgroundSettingsMenu();
            closeCounterSettingsMenu();
            closeLyricsSettingsMenu();
            audioSettingsMenu.classList.remove('hidden');
            showSettingsBackdrop();
            void audioSettingsMenu.offsetWidth;
            requestAnimationFrame(()=>audioSettingsMenu.classList.add('open'));
        }
        function colorFromPicker() {
            const c = pickerValue * pickerSaturation, x = c * (1 - Math.abs((pickerHue / 60) % 2 - 1)), m = pickerValue - c;
            let r=0,g=0,b=0;
            if (pickerHue<60) [r,g,b]=[c,x,0]; else if (pickerHue<120) [r,g,b]=[x,c,0]; else if (pickerHue<180) [r,g,b]=[0,c,x]; else if (pickerHue<240) [r,g,b]=[0,x,c]; else if (pickerHue<300) [r,g,b]=[x,0,c]; else [r,g,b]=[c,0,x];
            return '#' + [r,g,b].map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');
        }
        function setPickerColor(hex, apply=true, readHex=false) {
            if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
            if (readHex) {
                const n=parseInt(hex.slice(1),16), r=((n>>16)&255)/255,g=((n>>8)&255)/255,b=(n&255)/255;
                const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
                pickerValue=max;
                pickerSaturation=max===0?0:d/max;
                if (d > 0) {
                    pickerHue=max===r?60*(((g-b)/d)%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);
                    if (pickerHue<0) pickerHue+=360;
                }
            }
            lyricsColorHue.value=pickerHue;
            lyricsColorOpacity.value=String(Math.round(pickerOpacity*100));
            lyricsColorBrightness.value=String(pickerBrightness);
            lyricsColorOpacity.style.background=`linear-gradient(to right, transparent, ${colorFromPicker()})`;
            if (activeColorPickerOptions?.showBrightness) {
                const dark=getLyricsTagBackground(hex,25,1), light=getLyricsTagBackground(hex,75,1);
                lyricsColorBrightness.style.background=`linear-gradient(to right, #000, ${dark}, ${hex} 50%, ${light}, #fff)`;
            }
            const hueColor=`hsl(${pickerHue} 100% 50%)`;
            lyricsColorCanvas.style.backgroundImage=`linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),linear-gradient(${hueColor},${hueColor})`;
            const canvasRect=lyricsColorCanvas.getBoundingClientRect();
            const markerRadius=8;
            const markerX=Math.max(markerRadius,Math.min(canvasRect.width-markerRadius,pickerSaturation*canvasRect.width));
            const markerY=Math.max(markerRadius,Math.min(canvasRect.height-markerRadius,(1-pickerValue)*canvasRect.height));
            lyricsColorMarker.style.left=`${markerX}px`; lyricsColorMarker.style.top=`${markerY}px`;
            const colorPreview=`rgba(${parseInt(hex.slice(1,3),16)}, ${parseInt(hex.slice(3,5),16)}, ${parseInt(hex.slice(5,7),16)}, ${pickerOpacity})`;
            lyricsColorHex.value=hex.toUpperCase(); lyricsColorPreview.style.backgroundColor=colorPreview;
            if (activeColorPickerOptions?.preview) activeColorPickerOptions.preview.style.backgroundColor=colorPreview;
            if (apply) activeColorPickerOptions?.onChange?.(hex,pickerOpacity,pickerBrightness);
            lyricsColorReset.disabled=hex.toLowerCase()===pickerOriginal.toLowerCase() && pickerOpacity===(activeColorPickerOptions?.resetOpacity ?? 1) && pickerBrightness===(activeColorPickerOptions?.resetBrightness ?? 50);
        }
        function positionColorPicker(anchor=activeColorPickerOptions?.anchor) {
            if (!anchor) return;
            const p=lyricsColorPicker, floatingMenu=anchor.closest('#overlay-image-menu');
            const width=Math.min(300,innerWidth-24), height=p.offsetHeight;
            if (floatingMenu) {
                const m=floatingMenu.getBoundingClientRect();
                const rightLeft=m.right+8;
                const rightSpace=innerWidth-12-rightLeft, leftSpace=m.left-20;
                if (Math.max(rightSpace,leftSpace)>=160) {
                    const useRight=rightSpace>=leftSpace;
                    const available=useRight?rightSpace:leftSpace;
                    const sideWidth=Math.min(width,available);
                    p.style.width=`${sideWidth}px`;
                    p.style.left=`${useRight?rightLeft:m.left-sideWidth-8}px`;
                    const sideHeight=p.offsetHeight;
                    p.style.top=`${Math.max(12,Math.min(m.top,innerHeight-sideHeight-12))}px`;
                } else {
                    p.style.width='';
                    const tag=activeParenthesesTag?.getBoundingClientRect();
                    const below=m.bottom+8;
                    const pickerHeight=p.offsetHeight;
                    const aboveTag=tag?tag.top-pickerHeight-8:-1;
                    const top=below+pickerHeight<=innerHeight-12?below:aboveTag>=12?aboveTag:Math.max(12,Math.min(m.top,innerHeight-pickerHeight-12));
                    p.style.left=`${Math.max(12,Math.min(m.left,innerWidth-width-12))}px`;
                    p.style.top=`${top}px`;
                }
                return;
            }
            p.style.width='';
            const a=anchor.getBoundingClientRect(), menu=anchor.closest('.settings-drawer')?.getBoundingClientRect();
            let left=menu?menu.right+8:a.right+8;
            if(left+width>innerWidth-12) left=menu?Math.min(menu.right+8,innerWidth-width-12):a.left-width-8;
            left=Math.max(12,Math.min(left,innerWidth-width-12));
            const top=Math.max(12,Math.min(a.top+a.height/2-height/2,innerHeight-height-12));
            p.style.left=`${left}px`; p.style.top=`${top}px`;
        }
        function closeColorPicker() {
            lyricsColorPicker.classList.remove('open');
            activeColorPickerOptions=null;
        }
        function openColorPicker(options) {
            if (!options?.anchor || !/^#[\da-f]{6}$/i.test(options.color || '')) return;
            activeColorPickerOptions={
                anchor:options.anchor,
                preview:options.preview,
                color:options.color,
                opacity:options.opacity ?? 1,
                brightness:options.brightness ?? 50,
                resetColor:options.resetColor || options.color,
                resetOpacity:options.resetOpacity ?? options.opacity ?? 1,
                resetBrightness:options.resetBrightness ?? options.brightness ?? 50,
                showBrightness:Boolean(options.showBrightness),
                onDelete:options.onDelete,
                onChange:options.onChange || (()=>{})
            };
            pickerOriginal=activeColorPickerOptions.resetColor;
            pickerOpacity=activeColorPickerOptions.opacity;
            pickerBrightness=activeColorPickerOptions.brightness;
            lyricsColorOpacity.hidden=!options.showOpacity;
            lyricsColorBrightness.hidden=!options.showBrightness;
            lyricsColorDelete.hidden=!options.onDelete;
            lyricsColorPicker.classList.add('open');
            setPickerColor(activeColorPickerOptions.color,false,true);
            positionColorPicker();
        }
        function handleLyricsTagClick(event) {
            const parenthesesTag=event.target.closest('.lyrics-parentheses-tag');
            if (parenthesesTag) {
                event.stopPropagation();
                if (!overlayImageMenu.classList.contains('hidden')) {
                    overlayImageMenu.classList.add('hidden');
                    return;
                }
                openParenthesesTagMenu(parenthesesTag);
                return;
            }
            const tag=event.target.closest('.lyrics-tag');
            if (!tag) return;
            event.stopPropagation();
            if (lyricsColorPicker.classList.contains('open')) {
                closeColorPicker();
                return;
            }
            const label=tag.dataset.label;
            const style=getLyricsTagStyle(label);
            openColorPicker({
                anchor:tag,color:style.color,opacity:lyricsTagOpacity,brightness:lyricsTagBrightness,
                resetColor:style.initialColor,resetOpacity:0.4,resetBrightness:25,
                showOpacity:true,showBrightness:true,
                onChange:(color,opacity,brightness)=>{
                    style.color=color.toLowerCase();
                    lyricsTagOpacity=opacity;
                    lyricsTagBrightness=brightness;
                    [lyricsLinesTrack,compactLyricsTrack].forEach(track=>track.querySelectorAll('.lyrics-tag').forEach(item=>{
                        applyLyricsTagStyle(item,item.dataset.label);
                    }));
                }
            });
        }
        lyricsLinesTrack.addEventListener('click',handleLyricsTagClick);
        compactLyricsTrack.addEventListener('click',handleLyricsTagClick);
        function applyLyricsFill() {
            lyricsFillOpacity.value=String(Math.round(currentLyricsOpacity*100));
            const rgba=color=>`rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, ${currentLyricsOpacity})`;
            const imageMode=lyricsFrameImageState.mode==='image';
            const invisibleMode=lyricsFrameImageState.mode==='invisible';
            const fillColor=imageMode||invisibleMode?'transparent':rgba(currentLyricsColors[0]);
            [cuadroDeLetras,compactAudioFrame].forEach(frame=>frame.style.backgroundColor=fillColor);
            const stops=[];
            if (currentLyricsColors.length>1) {
                currentLyricsColors.forEach((color,index)=>stops.push(`${rgba(color)} ${index/(currentLyricsColors.length-1)*100}%`));
            }
            const gradient=!imageMode&&!invisibleMode&&currentLyricsColors.length>1
                ? `linear-gradient(to bottom right in oklab, ${stops.join(', ')})`
                : 'none';
            [cuadroDeLetras,compactAudioFrame].forEach(frame=>{
                frame.classList.toggle('image-mode',imageMode);
                frame.classList.toggle('invisible-mode',invisibleMode);
                frame.style.backgroundImage=invisibleMode?'none':gradient;
                frame.style.backgroundOrigin='border-box';
                frame.style.backgroundClip='border-box';
            });
            lyricsColorAdd.hidden=currentLyricsColors.length>=3;
            applyLyricsShadowOrGlow();
            updateLyricsLinePosition();
        }
        function applyAdaptiveFrameShadowOrGlow(element,mode,color,shadowOffset,shadowBlur) {
            if (mode==='off') {
                element.style.boxShadow='none';
                return;
            }
            const scale=Math.min(1,Math.sqrt((window.innerWidth/frameShadowReferenceViewport.width)*(window.innerHeight/frameShadowReferenceViewport.height)));
            const px=value=>`${value*scale}px`;
            if (mode==='shadow') {
                element.style.boxShadow=`0 ${px(shadowOffset)} ${px(shadowBlur)} rgba(0, 0, 0, 0.5)`;
                return;
            }
            const red=parseInt(color.slice(1,3),16);
            const green=parseInt(color.slice(3,5),16);
            const blue=parseInt(color.slice(5,7),16);
            element.style.boxShadow=`0 0 ${px(12)} ${px(3)} rgba(255,255,255,1), 0 0 ${px(19)} ${px(8)} rgba(${red},${green},${blue},.6)`;
        }
        const applyLyricsShadowOrGlow=()=>{
            [cuadroDeLetras,compactAudioFrame].forEach(frame=>{
                if (lyricsFrameImageState.mode==='invisible') frame.style.boxShadow='none';
                else applyAdaptiveFrameShadowOrGlow(frame,currentLyricsGlowMode,currentLyricsGlowColor,10,45);
            });
        };
        const applyAudioShadowOrGlow=()=>{
            applyAdaptiveFrameShadowOrGlow(cuadroDeAudio,currentAudioGlowMode,currentAudioGlowColor,6,25);
            applyAdaptiveFrameShadowOrGlow(btnUploadAudio,currentAudioGlowMode,currentAudioGlowColor,6,25);
        };
        const applyPlayButtonShadowOrGlow=()=>{
            if (!playButtonCircleVisible || currentPlayButtonGlowMode==='off') {
                btnPlayPause.style.boxShadow='none';
                compactPlayPauseButton.style.boxShadow='none';
                return;
            }
            const scale=Math.min(1,Math.sqrt((window.innerWidth/frameShadowReferenceViewport.width)*(window.innerHeight/frameShadowReferenceViewport.height)));
            const px=value=>`${value*scale}px`;
            if (currentPlayButtonGlowMode==='light') {
                const red=parseInt(currentPlayButtonGlowColor.slice(1,3),16);
                const green=parseInt(currentPlayButtonGlowColor.slice(3,5),16);
                const blue=parseInt(currentPlayButtonGlowColor.slice(5,7),16);
                const shadow=`0 0 ${px(18)} ${px(6)} rgba(${red},${green},${blue},.8)`;
                btnPlayPause.style.boxShadow=shadow;
                compactPlayPauseButton.style.boxShadow=shadow;
            } else {
                const shadow=`0 0 ${px(15)} rgba(0,0,0,.6)`;
                btnPlayPause.style.boxShadow=shadow;
                compactPlayPauseButton.style.boxShadow=shadow;
            }
        };
        function bindFrameShadowLightControls(button,colorButton,getMode,setMode,getColor,setColor,apply,reserveColorSpace=false) {
            button.addEventListener('click',e=>{
                e.stopPropagation();
                setMode(({shadow:'light',light:'off',off:'shadow'})[getMode()]||'shadow');
                const mode=getMode();
                const label=mode==='light'?'Luz':mode==='off'?'Desactivado':'Sombra';
                button.textContent=label;
                button.setAttribute('aria-pressed',String(mode!=='off'));
                button.setAttribute('aria-label',`Efecto actual: ${label.toLowerCase()}. Cambiar efecto`);
                if(reserveColorSpace) colorButton.style.visibility=mode==='light'?'visible':'hidden';
                else colorButton.classList.toggle('hidden',mode!=='light');
                apply();
            });
            colorButton.addEventListener('click',e=>{
                e.stopPropagation();
                openColorPicker({
                    anchor:colorButton, preview:colorButton, color:getColor(), resetColor:getColor(),
                    opacity:1, resetOpacity:1, showOpacity:false,
                    onChange:color=>{setColor(color.toLowerCase());colorButton.style.backgroundColor=color;apply();}
                });
            });
        }
        function bindFillBlurSlider(slider,targets) {
            const update=()=>{
                const value=Number(slider.value);
                targets.forEach(target=>target.style.setProperty('--fill-backdrop-blur',`${value}px`));
            };
            slider.addEventListener('input',update);
            update();
        }
        bindFrameShadowLightControls(lyricsShadowLightToggle,lyricsGlowColorTrigger,()=>currentLyricsGlowMode,value=>{currentLyricsGlowMode=value;},()=>currentLyricsGlowColor,value=>{currentLyricsGlowColor=value;},applyLyricsShadowOrGlow,true);
        bindFrameShadowLightControls(audioShadowLightToggle,audioGlowColorTrigger,()=>currentAudioGlowMode,value=>{currentAudioGlowMode=value;},()=>currentAudioGlowColor,value=>{currentAudioGlowColor=value;},applyAudioShadowOrGlow);
        bindFrameShadowLightControls(playButtonShadowLightToggle,playButtonGlowColorTrigger,()=>currentPlayButtonGlowMode,value=>{currentPlayButtonGlowMode=value;},()=>currentPlayButtonGlowColor,value=>{currentPlayButtonGlowColor=value;},applyPlayButtonShadowOrGlow);
        bindFillBlurSlider(lyricsFillBlur,[cuadroDeLetras,compactAudioFrame]);
        lyricsFillOpacity.addEventListener('input',()=>{currentLyricsOpacity=Number(lyricsFillOpacity.value)/100;applyLyricsFill();});
        bindFillBlurSlider(audioFillBlur,[cuadroDeAudio,btnUploadAudio]);
        applyLyricsShadowOrGlow();
        applyAudioShadowOrGlow();
        applyPlayButtonShadowOrGlow();
        function openLyricsStopPicker(index, anchor) {
            activeLyricsColorIndex=index;
            openColorPicker({
                anchor, preview:anchor, color:currentLyricsColors[index],
                resetColor:currentLyricsColors[index], showOpacity:false,
                onChange:color=>{
                    currentLyricsColors[index]=color.toLowerCase();
                    anchor.dataset.color=color.toLowerCase();
                    if (index===0) currentLyricsColor=currentLyricsColors[0];
                    applyLyricsFill();
                },
                onDelete:currentLyricsColors.length>1 ? ()=>{
                    if (currentLyricsColors.length<2) return;
                    currentLyricsColors.splice(index,1);
                    anchor.remove();
                    [...lyricsColorSwatches.querySelectorAll('button[data-color-index]')].forEach((button,nextIndex)=>{
                        button.dataset.colorIndex=String(nextIndex);
                        button.setAttribute('aria-label',nextIndex===0?'Elegir color principal':`Elegir color ${nextIndex+1}`);
                        button.title=nextIndex===0?'Color principal':`Color ${nextIndex+1}`;
                    });
                    currentLyricsColor=currentLyricsColors[0];
                    applyLyricsFill();
                    closeColorPicker();
                } : null
            });
        }
        lyricsColorSwatches.addEventListener('click',e=>{
            if (suppressColorClick) {
                suppressColorClick=false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            const button=e.target.closest('button[data-color-index]');
            if (!button) return;
            e.stopPropagation();
            if (lyricsColorPicker.classList.contains('open') && activeColorPickerOptions?.anchor===button) {
                closeColorPicker();
                return;
            }
            openLyricsStopPicker(Number(button.dataset.colorIndex),button);
        });
        function clearColorDropGuide() {
            lyricsColorSwatches.querySelectorAll('.drop-before,.drop-after').forEach(button=>button.classList.remove('drop-before','drop-after'));
            colorDropTarget=null;
        }
        lyricsColorSwatches.addEventListener('dragstart',e=>{
            const button=e.target.closest('button[data-color-index]');
            if (!button) return;
            draggedColorButton=button;
            suppressColorClick=true;
            button.classList.add('color-dragging');
            e.dataTransfer.effectAllowed='move';
            e.dataTransfer.setData('text/plain',button.dataset.colorIndex);
        });
        lyricsColorSwatches.addEventListener('dragover',e=>{
            if (!draggedColorButton) return;
            e.preventDefault();
            e.dataTransfer.dropEffect='move';
            clearColorDropGuide();
            const buttons=[...lyricsColorSwatches.querySelectorAll('button[data-color-index]')].filter(button=>button!==draggedColorButton);
            const next=buttons.find(button=>e.clientX<button.getBoundingClientRect().left+button.getBoundingClientRect().width/2);
            colorDropTarget=next || buttons.at(-1) || null;
            colorDropBefore=Boolean(next);
            if (colorDropTarget) colorDropTarget.classList.add(colorDropBefore?'drop-before':'drop-after');
        });
        lyricsColorSwatches.addEventListener('drop',e=>{
            if (!draggedColorButton || !colorDropTarget) return;
            e.preventDefault();
            if (colorDropBefore) lyricsColorSwatches.insertBefore(draggedColorButton,colorDropTarget);
            else colorDropTarget.after(draggedColorButton);
            const buttons=[...lyricsColorSwatches.querySelectorAll('button[data-color-index]')];
            currentLyricsColors=buttons.map(button=>button.dataset.color);
            buttons.forEach((button,index)=>{
                button.dataset.colorIndex=String(index);
                button.setAttribute('aria-label',index===0?'Elegir color principal':`Elegir color ${index+1}`);
                button.title=index===0?'Color principal':`Color ${index+1}`;
            });
            currentLyricsColor=currentLyricsColors[0];
            applyLyricsFill();
            clearColorDropGuide();
        });
        lyricsColorSwatches.addEventListener('dragend',()=>{
            draggedColorButton?.classList.remove('color-dragging');
            draggedColorButton=null;
            clearColorDropGuide();
            setTimeout(()=>{suppressColorClick=false;},600);
        });
        lyricsColorAdd.addEventListener('click',e=>{
            e.stopPropagation();
            if (currentLyricsColors.length>=3) return;
            const index=currentLyricsColors.push('#ffffff')-1;
            const button=document.createElement('button');
            button.type='button'; button.classList.add('color-choice-button'); button.draggable=true; button.dataset.colorIndex=String(index); button.dataset.color='#ffffff';
            button.setAttribute('aria-label',`Elegir color ${index+1}`); button.title=`Color ${index+1}`;
            button.style.backgroundColor='#ffffff';
            lyricsColorSwatches.append(button);
            applyLyricsFill();
        });
        function applyAudioFill() {
            const rgba=color=>`rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, ${currentAudioOpacity})`;
            const imageMode=audioFrameImageState.mode==='image';
            const fillColor=imageMode?'transparent':rgba(currentAudioColors[0]);
            const gradient=!imageMode&&currentAudioColors.length>1
                ? `linear-gradient(to bottom right in oklab, ${currentAudioColors.map((color,index)=>`${rgba(color)} ${index/(currentAudioColors.length-1)*100}%`).join(', ')})`
                : 'none';
            [cuadroDeAudio,btnUploadAudio].forEach(frame=>{
                frame.style.setProperty('--audio-fill-color',fillColor);
                frame.style.setProperty('--audio-fill-gradient',gradient);
                frame.classList.toggle('image-mode',imageMode);
            });
            cuadroDeAudio.style.backgroundOrigin='border-box';
            cuadroDeAudio.style.backgroundClip='border-box';
            audioColorAdd.hidden=currentAudioColors.length>=3;
        }
        function createFrameImageControls(menu,state,colorControls,apply,label,frames,allowInvisible=false) {
            const group=document.createElement('div');
            group.className='frame-image-mode-controls';
            const lyricsBlurControl=menu===lyricsSettingsMenu?lyricsFillBlur.parentElement:null;
            const lyricsBlurParent=menu===lyricsSettingsMenu?lyricsBlurControl.parentElement:null;
            const layers=frames.map(frame=>{
                const image=document.createElement('img');
                image.className='frame-image-layer hidden';
                image.alt='';
                frame.prepend(image);
                return image;
            });
            state.opacity=state.opacity??1;
            const modeButton=document.createElement('button');
            modeButton.type='button';
            modeButton.className='frame-mode-toggle';
            const fileInput=document.createElement('input');
            fileInput.type='file';
            fileInput.accept='image/*';
            fileInput.className='hidden';
            fileInput.setAttribute('aria-label',`Seleccionar imagen para ${label}`);
            if (menu===lyricsSettingsMenu) settingsSyncButtons.find(button=>button.dataset.syncColors==='lyrics').imageInput=fileInput;
            if (menu===audioSettingsMenu) settingsSyncButtons.find(button=>button.dataset.syncColors==='audio').imageInput=fileInput;
            const opacityInput=document.createElement('input');
            opacityInput.id=menu===audioSettingsMenu?'audio-frame-image-opacity':'lyrics-frame-image-opacity';
            opacityInput.type='range';
            opacityInput.className='range-slider frame-image-opacity';
            opacityInput.min='0';
            opacityInput.max='100';
            opacityInput.step='1';
            opacityInput.value=String(Math.round(state.opacity*100));
            opacityInput.setAttribute('aria-label',`Opacidad de la imagen de ${label}`);
            const opacityControl=document.createElement('div');
            opacityControl.className='settings-slider-control frame-slider-control';
            const opacityLabel=document.createElement('label');
            opacityLabel.className='settings-slider-label';
            opacityLabel.htmlFor=opacityInput.id;
            opacityLabel.textContent='Opacidad';
            const audioBlurControl=menu===audioSettingsMenu?audioFillBlur.closest('.settings-slider-control'):null;
            const audioBlurItem=audioBlurControl?.closest('li')||null;
            const audioSliderStack=menu===audioSettingsMenu?document.createElement('div'):null;
            const audioSliderDivider=menu===audioSettingsMenu?document.createElement('div'):null;
            if (audioSliderStack) {
                audioSliderStack.className='audio-fill-slider-controls';
                audioSliderDivider.className='settings-section-divider audio-settings-divider';
                audioSliderStack.append(audioSliderDivider,opacityControl,audioBlurControl);
                audioBlurItem.replaceChildren(audioSliderStack);
            }
            const imageBottomDivider=document.createElement('div');
            imageBottomDivider.className='lyrics-image-bottom-divider';
            imageBottomDivider.setAttribute('aria-hidden','true');
            const update=()=>{
                const isImage=state.mode==='image';
                const isInvisible=state.mode==='invisible';
                modeButton.textContent=isImage?'Modo: Imagen':state.mode==='invisible'?'Modo: Invisible':'Modo: Color';
                modeButton.setAttribute('aria-pressed',String(state.mode!=='color'));
                if (menu===audioSettingsMenu) opacityInput.value=String(Math.round((isImage?state.opacity:currentAudioOpacity)*100));
                opacityInput.classList.toggle('hidden',menu!==audioSettingsMenu&&!isImage);
                opacityControl.classList.toggle('hidden',menu!==audioSettingsMenu&&!isImage);
                if (menu===lyricsSettingsMenu) { group.classList.toggle('image-mode',isImage); group.classList.toggle('invisible-mode',isInvisible); menu.classList.toggle('image-mode',isImage); const fillControls=document.getElementById('lyrics-fill-controls'); fillControls.classList.toggle('hidden',isInvisible); fillControls.closest('li').classList.toggle('hidden',isInvisible); lyricsBlurParent.classList.toggle('hidden',isInvisible); lyricsFillBlur.classList.toggle('image-mode',isImage); lyricsFillBlur.classList.toggle('hidden',isInvisible); if(isImage) { group.append(opacityControl,lyricsBlurControl,imageBottomDivider); } else { lyricsBlurParent.append(lyricsBlurControl); } const modeRow=menu.querySelector('.frame-mode-selector-row'); modeRow?.classList.toggle('invisible-mode',isInvisible); }
                colorControls.classList.toggle('hidden',state.mode!=='color');
                if (menu===lyricsSettingsMenu) lyricsFillOpacity.closest('.settings-slider-control').classList.toggle('hidden',state.mode!=='color');
                if (menu===lyricsSettingsMenu) { const syncButton=settingsSyncButtons.find(button=>button.dataset.syncColors==='lyrics'), hidden=state.mode==='invisible'; syncButton.style.visibility=hidden?'hidden':'visible'; syncButton.setAttribute('aria-hidden',String(hidden)); syncButton.innerHTML=isImage?uploadIconSvg:syncIconSvg; syncButton.setAttribute('aria-label',isImage?'Cargar imagen para las letras':'Sincronizar colores'); }
                if (menu===audioSettingsMenu) { const syncButton=settingsSyncButtons.find(button=>button.dataset.syncColors==='audio'); syncButton.innerHTML=isImage?uploadIconSvg:syncIconSvg; syncButton.setAttribute('aria-label',isImage?'Cargar imagen':'Sincronizar colores'); audioSliderDivider.classList.toggle('hidden',isImage); if(isImage) { group.append(audioSliderStack); audioBlurItem.hidden=true; } else { audioBlurItem.append(audioSliderStack); audioBlurItem.hidden=false; } }
                layers.forEach(image=>{
                    image.classList.toggle('hidden',!isImage||!state.url);
                    if (state.url) image.src=state.url;
                    image.style.opacity=String(state.opacity);
                });
            };
            modeButton.addEventListener('click',()=>{
                state.mode=allowInvisible
                    ? ({color:'image',image:'invisible',invisible:'color'}[state.mode]||'color')
                    : state.mode==='color'?'image':'color';
                update();
                apply();
            });
            opacityInput.addEventListener('input',()=>{
                const opacity=Number(opacityInput.value)/100;
                if (menu===audioSettingsMenu&&state.mode!=='image') {
                    currentAudioOpacity=opacity;
                    apply();
                } else {
                    state.opacity=opacity;
                    layers.forEach(image=>image.style.opacity=String(state.opacity));
                }
            });
            fileInput.addEventListener('change',()=>{
                const file=fileInput.files?.[0];
                if (!file || !file.type.startsWith('image/')) return;
                if (state.url) URL.revokeObjectURL(state.url);
                state.url=URL.createObjectURL(file);
                state.mode='image';
                update();
                apply();
                fileInput.value='';
            });
            opacityControl.append(opacityLabel,opacityInput);
            group.append(modeButton,fileInput);
            const modePill=addSettingsOptionPill(modeButton,(allowInvisible?['Invisible','Color','Imagen']:['Color','Imagen']).map(label=>({label,value:label})),()=>modeButton.textContent.replace(/^Modo:\s*/,'').trim());
            if (menu===lyricsSettingsMenu) { const row=document.createElement('div'); row.className='frame-mode-selector-row'; modePill.before(row); row.append(modePill,settingsSyncButtons.find(button=>button.dataset.syncColors==='lyrics')); }
            if (menu===audioSettingsMenu) {
                const row=document.createElement('div');
                row.className='frame-mode-selector-row audio-compact-hide';
                const modeDivider=document.createElement('div');
                modeDivider.className='settings-section-divider audio-settings-divider audio-compact-hide';
                const colorDivider=document.createElement('div');
                colorDivider.className='settings-section-divider audio-settings-divider audio-compact-hide';
                group.classList.add('audio-compact-hide');
                const modeList=menu.querySelector('ul');
                const fillHeading=[...menu.querySelectorAll('.settings-group-title')].find(title=>title.textContent.trim()==='Relleno');
                modePill.before(row);
                row.append(modePill,settingsSyncButtons.find(button=>button.dataset.syncColors==='audio'));
                modeList.after(modeDivider,...(fillHeading?[fillHeading]:[]),group);
                const colorList=menu.querySelectorAll('ul')[1];
                colorList.after(colorDivider);
            } else {
                const fillHeading=[...menu.querySelectorAll('.lyrics-settings-title')].find(title=>title.textContent.trim()==='Relleno');
                if (fillHeading) menu.querySelector('.settings-back-button').after(fillHeading,group);
                else menu.querySelector('.settings-back-button').after(group);
            }
            if (menu===lyricsSettingsMenu) setLyricsFrameMode = mode => {
                if (!['color','invisible'].includes(mode)) return;
                state.mode=mode;
                update();
                apply();
            };
            if (menu===audioSettingsMenu) setAudioFrameMode = mode => {
                if (!['color','image'].includes(mode)) return;
                state.mode=mode;
                update();
                apply();
            };
            update();
        }
        createFrameImageControls(
            lyricsSettingsMenu,lyricsFrameImageState,document.getElementById('lyrics-color-controls'),applyLyricsFill,'el cuadro de letras',[cuadroDeLetras,compactAudioFrame],true
        );
        createFrameImageControls(
            audioSettingsMenu,audioFrameImageState,document.getElementById('audio-color-controls'),applyAudioFill,'el cuadro de audio',[cuadroDeAudio,btnUploadAudio]
        );
        applyLyricsFill();
        function replaceColorSwatches(container,colors,label,opacity=1) {
            container.replaceChildren(...colors.map((color,index)=>{
                const button=document.createElement('button');
                button.type='button';
                button.className='color-choice-button';
                button.draggable=container!==backgroundColorSwatches;
                button.dataset.colorIndex=String(index);
                button.dataset.color=color;
                button.style.backgroundColor=`rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, ${opacity})`;
                button.setAttribute('aria-label',index?`Elegir color ${label} ${index+1}`:`Elegir color principal ${label}`);
                button.title=index?`Color ${index+1}`:'Color principal';
                return button;
            }));
        }
        function syncBlur(target,source) {
            target.value=source.value;
            target.dispatchEvent(new Event('input',{bubbles:true}));
        }
        function reflectFrameEffect(toggle,colorButton,mode,color) {
            const isLight=mode==='light';
            const label=isLight?'Luz':mode==='off'?'Desactivado':'Sombra';
            toggle.textContent=label;
            toggle.setAttribute('aria-pressed',String(mode!=='off'));
            toggle.setAttribute('aria-label',`Efecto actual: ${label.toLowerCase()}. Cambiar efecto`);
            if(colorButton===lyricsGlowColorTrigger) { colorButton.classList.remove('hidden'); colorButton.style.visibility=isLight?'visible':'hidden'; }
            else colorButton.classList.toggle('hidden',!isLight);
            colorButton.style.backgroundColor=color;
        }
        const themeSaveButton=document.getElementById('theme-save-button');
        const themeLoadButton=document.getElementById('theme-load-button');
        const themeFileInput=document.getElementById('theme-file-input');
        const themeColorPattern=/^#[0-9a-f]{6}$/i;
        const themeAutomaticLength='automatico';
        const readThemeLength=property=>document.documentElement.style.getPropertyValue(property).trim()||themeAutomaticLength;
        const applyThemeLength=(property,value)=>{
            if (value===themeAutomaticLength) document.documentElement.style.removeProperty(property);
            else document.documentElement.style.setProperty(property,value);
        };
        async function saveFileAs(blobOrFactory,suggestedName,description,mimeType,extension){
            if (typeof window.showSaveFilePicker!=='function') {
                throw new Error('Este navegador no permite abrir «Guardar como». Usa Chrome o Edge actualizado para guardar el archivo.');
            }
            const handle=await window.showSaveFilePicker({
                suggestedName,
                types:[{description,accept:{[mimeType]:[extension]}}]
            });
            const blob=typeof blobOrFactory==='function'?await blobOrFactory(handle.name):blobOrFactory;
            const writable=await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return handle.name;
        }
        function createCurrentTheme(name) {
            const theme={
                formato:'RecK tema',
                version:1,
                nombre:name,
                guardadoEn:new Date().toISOString(),
                fondo:{modo:currentBackgroundMode==='image'?'imagen':currentBackgroundMode},
                panelDeLetras:{modo:lyricsFrameImageState.mode==='image'?'imagen':lyricsFrameImageState.mode},
                panelDeAudio:{
                    estilo:({floating:'flotante',full:'completo',invisible:'invisible',compact:'compacto'})[audioLayoutMode.dataset.mode],
                    relleno:{modo:audioFrameImageState.mode==='image'?'imagen':'color'},
                    efecto:{
                        tipo:({shadow:'sombra',light:'luz',off:'desactivado'})[currentAudioGlowMode]||'sombra',
                        colorLuz:currentAudioGlowColor
                    },
                    colorTexto:currentAudioTextColor
                },
                extras:{
                    botonDePausa:{
                        estilo:playButtonCircleVisible?'completo':'simple',
                        colorCirculo:currentPlayButtonCircleColor,
                        colorIconosAudio:currentAudioIconColor,
                        efecto:({shadow:'sombra',light:'luz',off:'desactivado'})[currentPlayButtonGlowMode]||'sombra',
                        colorLuz:currentPlayButtonGlowColor
                    },
                    barraDeProgreso:{
                        estilo:currentProgressTrackMode==='dark'?'oscuro':'claro',
                        tipoRelleno:currentProgressColors.length>1?'gradiente':'simple',
                        colores:[...currentProgressColors],
                        circulo:{visible:currentCounterThumbVisible,color:currentCounterThumbColor}
                    },
                    rellenoContadores:{
                        color:currentCounterColor,
                        opacidadPorcentaje:Math.round(currentCounterOpacity*100)
                    }
                },
                disposicion:{
                    panelDeAudio:{
                        ancho:readThemeLength('--audio-width'),
                        alto:readThemeLength('--audio-height')
                    },
                    separacionContadoresPx:Math.round(currentPillOffset*100)/100,
                    controlesYTitulos:compactAudioFrame.classList.contains('controls-below-seekbar')?'debajo':'arriba',
                    panelDeLetras:{
                        ancho:readThemeLength('--letras-width'),
                        alto:readThemeLength('--letras-height'),
                        superior:readThemeLength('--letras-top'),
                        izquierda:readThemeLength('--letras-left')
                    },
                    panelCompacto:{
                        posicionLineaDivisoraEscala:Number(getComputedStyle(compactAudioFrame).getPropertyValue('--compact-divider-offset-scale'))||2.7,
                        ladoReproduccion:compactAudioFrame.classList.contains('compact-sides-reversed')?'derecha':'izquierda'
                    },
                    textoLetrasYCompacto:{
                        color:currentLyricsTextColor,
                        alineacion:({left:'izquierda',center:'centro',right:'derecha'})[getComputedStyle(document.documentElement).getPropertyValue('--lyrics-text-align').trim()]||'centro',
                        escala:Number(document.documentElement.style.getPropertyValue('--lyrics-font-scale'))||1
                    }
                }
            };
            theme.disposicion.panelCompacto.ancho=readThemeLength('--letras-width');
            theme.disposicion.panelCompacto.alto=readThemeLength('--letras-height');
            const vinyl=activeVinylCover||lastVinylCoverSettings;
            if (vinyl) {
                const rect=activeVinylCover?.element.getBoundingClientRect();
                const isVisible=rect?.width>0;
                const size=isVisible?rect.width:vinyl.sizePx;
                const position=(axis,viewportSize)=>{
                    if (isVisible) return rect[axis];
                    const raw=activeVinylCover?.element.style[axis]??vinyl[axis];
                    const value=parseFloat(raw)||0;
                    return typeof raw==='string'&&raw.trim().endsWith('%')
                        ? value*viewportSize/100-(activeVinylCover?.element.style.transform.includes('-50%')?size/2:0)
                        : value;
                };
                theme.vinilo={
                    tamanoPx:Math.round(size*100)/100,
                    posicion:{
                        izquierdaPx:Math.round(position('left',innerWidth)*100)/100,
                        superiorPx:Math.round(position('top',innerHeight)*100)/100
                    },
                    estilo:({classic:'clasico',modern:'moderno',premium:'premium'})[vinyl.mode],
                    borde:{grosorPx:vinyl.borderWidth,color:vinyl.borderColor},
                    capa:({behind:'detras',between:'entre',front:'delante'})[vinyl.layer]
                };
            }
            if (currentBackgroundMode==='color') {
                theme.fondo.tipoRelleno=currentBackgroundColors.length>1?'gradiente':'simple';
                theme.fondo.colores=[...currentBackgroundColors];
            }
            if (audioLayoutMode.dataset.mode==='compact') {
                theme.disposicion.panelCompacto.pantallaCompleta=document.body.classList.contains('compact-fullscreen');
            }
            if (['color','invisible'].includes(lyricsFrameImageState.mode)) {
                theme.panelDeLetras.relleno={
                    tipo:currentLyricsColors.length>1?'gradiente':'simple',
                    colores:[...currentLyricsColors],
                    opacidadPorcentaje:Math.round(currentLyricsOpacity*100)
                };
                theme.panelDeLetras.efecto={
                    tipo:({shadow:'sombra',light:'luz',off:'desactivado'})[currentLyricsGlowMode]||'sombra',
                    colorLuz:currentLyricsGlowColor
                };
                theme.panelDeLetras.desenfoquePx=Number(lyricsFillBlur.value);
            }
            if (audioFrameImageState.mode==='color') {
                theme.panelDeAudio.relleno.tipo=currentAudioColors.length>1?'gradiente':'simple';
                theme.panelDeAudio.relleno.colores=[...currentAudioColors];
                theme.panelDeAudio.relleno.opacidadPorcentaje=Math.round(currentAudioOpacity*100);
                theme.panelDeAudio.relleno.desenfoquePx=Number(audioFillBlur.value);
            }
            return theme;
        }
        function validateThemeColorList(colors,type,label) {
            if (!Array.isArray(colors)||colors.length<1||colors.length>3||!colors.every(color=>typeof color==='string'&&themeColorPattern.test(color))) {
                throw new Error(`${label}: se esperaba una lista de 1 a 3 colores HEX (#RRGGBB).`);
            }
            if ((type==='simple'&&colors.length!==1)||(type==='gradiente'&&colors.length<2)||!['simple','gradiente'].includes(type)) {
                throw new Error(`${label}: el tipo simple o gradiente no coincide con la cantidad de colores.`);
            }
            return colors.map(color=>color.toLowerCase());
        }
        function validateTheme(theme) {
            if (!theme||typeof theme!=='object'||Array.isArray(theme)||theme.formato!=='RecK tema'||theme.version!==1) {
                throw new Error('El archivo no tiene un formato de tema RecK compatible.');
            }
            if (typeof theme.nombre!=='string'||!theme.nombre.trim()) throw new Error('El tema necesita un nombre.');
            if (!theme.fondo||typeof theme.fondo!=='object'||!['color','imagen','video'].includes(theme.fondo.modo)) {
                throw new Error('Falta un modo de fondo válido.');
            }
            const validated={nombre:theme.nombre.trim(),fondo:null,panelDeLetras:null,panelDeAudio:null,extras:null,disposicion:null,vinilo:null};
            if (theme.fondo.modo==='color') {
                validated.fondo={modo:'color',colores:validateThemeColorList(theme.fondo.colores,theme.fondo.tipoRelleno,'fondo')};
            }
            const panel=theme.panelDeLetras;
            if (!panel||typeof panel!=='object'||!['color','invisible','imagen'].includes(panel.modo)) {
                throw new Error('Falta un modo válido para el panel de letras.');
            }
            if (['color','invisible'].includes(panel.modo)) {
                const fill=panel.relleno;
                const effect=panel.efecto;
                if (!fill||typeof fill!=='object') throw new Error('Falta el relleno del panel de letras.');
                if (!effect||typeof effect!=='object'||!['sombra','luz','desactivado'].includes(effect.tipo)||!themeColorPattern.test(effect.colorLuz)) {
                    throw new Error('El efecto o color de luz del panel de letras no es válido.');
                }
                const opacity=fill.opacidadPorcentaje;
                const blur=panel.desenfoquePx;
                if (!Number.isInteger(opacity)||opacity<0||opacity>100) throw new Error('La opacidad debe ser un número entero entre 0 y 100.');
                if (!Number.isInteger(blur)||blur<0||blur>24) throw new Error('El desenfoque debe ser un número entero entre 0 y 24.');
                validated.panelDeLetras={
                    modo:panel.modo,
                    colores:validateThemeColorList(fill.colores,fill.tipo,'relleno del panel de letras'),
                    opacidad:opacity,
                    efecto:effect.tipo,
                    colorLuz:effect.colorLuz.toLowerCase(),
                    desenfoque:blur
                };
            }
                const audio=theme.panelDeAudio;
                const layoutModes={flotante:'floating',completo:'full',invisible:'invisible',compacto:'compact'};
                if (!audio||typeof audio!=='object'||!layoutModes[audio.estilo]) throw new Error('Falta un estilo válido para el panel de audio.');
                if (!audio.relleno||typeof audio.relleno!=='object'||!['color','imagen'].includes(audio.relleno.modo)) throw new Error('Falta un modo de relleno válido para el panel de audio.');
                if (!audio.efecto||typeof audio.efecto!=='object'||!['sombra','luz','desactivado'].includes(audio.efecto.tipo)||!themeColorPattern.test(audio.efecto.colorLuz)) {
                    throw new Error('El efecto o color de luz del panel de audio no es válido.');
                }
                if (typeof audio.colorTexto!=='string'||!themeColorPattern.test(audio.colorTexto)) throw new Error('El color de texto del panel de audio debe ser HEX (#RRGGBB).');
                const validatedAudio={
                    estilo:layoutModes[audio.estilo],
                    modoRelleno:audio.relleno.modo,
                    efecto:audio.efecto.tipo,
                    colorLuz:audio.efecto.colorLuz.toLowerCase(),
                    colorTexto:audio.colorTexto.toLowerCase()
                };
                if (audio.relleno.modo==='color') {
                    const fill=audio.relleno;
                    const opacity=fill.opacidadPorcentaje;
                    const blur=fill.desenfoquePx;
                    if (!Number.isInteger(opacity)||opacity<0||opacity>100) throw new Error('La opacidad del panel de audio debe ser un entero entre 0 y 100.');
                    if (!Number.isInteger(blur)||blur<0||blur>24) throw new Error('El desenfoque del panel de audio debe ser un entero entre 0 y 24.');
                    validatedAudio.colores=validateThemeColorList(fill.colores,fill.tipo,'relleno del panel de audio');
                    validatedAudio.opacidad=opacity;
                    validatedAudio.desenfoque=blur;
                }
                validated.panelDeAudio=validatedAudio;
                const extras=theme.extras;
                const pause=extras?.botonDePausa;
                const progress=extras?.barraDeProgreso;
                const counters=extras?.rellenoContadores;
                if (!pause||!progress||!counters) throw new Error('Faltan opciones de extras del tema.');
                if (!['simple','completo'].includes(pause.estilo)||!['sombra','luz','desactivado'].includes(pause.efecto)) {
                    throw new Error('El estilo o efecto del botón de pausa no es válido.');
                }
                if (![pause.colorCirculo,pause.colorIconosAudio,pause.colorLuz].every(color=>typeof color==='string'&&themeColorPattern.test(color))) {
                    throw new Error('Los colores del botón de pausa deben estar en formato HEX (#RRGGBB).');
                }
                if (!['oscuro','claro'].includes(progress.estilo)) throw new Error('El estilo de la barra debe ser oscuro o claro.');
                const progressColors=validateThemeColorList(progress.colores,progress.tipoRelleno,'barra de progreso');
                if (progressColors.length>2) throw new Error('La barra de progreso admite uno o dos colores.');
                if (!progress.circulo||typeof progress.circulo.visible!=='boolean'||typeof progress.circulo.color!=='string'||!themeColorPattern.test(progress.circulo.color)) {
                    throw new Error('La visibilidad o el color del círculo de progreso no es válido.');
                }
                const counterOpacity=counters.opacidadPorcentaje;
                if (typeof counters.color!=='string'||!themeColorPattern.test(counters.color)) throw new Error('El color de relleno de los contadores debe ser HEX (#RRGGBB).');
                if (!Number.isInteger(counterOpacity)||counterOpacity<0||counterOpacity>100) throw new Error('La opacidad de los contadores debe ser un entero entre 0 y 100.');
                validated.extras={
                    botonDePausa:{
                        visible:pause.estilo==='completo',
                        colorCirculo:pause.colorCirculo.toLowerCase(),
                        colorIconosAudio:pause.colorIconosAudio.toLowerCase(),
                        efecto:pause.efecto,
                        colorLuz:pause.colorLuz.toLowerCase()
                    },
                    barraDeProgreso:{
                        estilo:progress.estilo==='oscuro'?'dark':'light',
                        colores:progressColors,
                        circuloVisible:progress.circulo.visible,
                        colorCirculo:progress.circulo.color.toLowerCase()
                    },
                    rellenoContadores:{color:counters.color.toLowerCase(),opacidad:counterOpacity}
                };
                const layout=theme.disposicion;
                const validateLength=(value,label,{allowAutomatic=true,allowNegative=false}={})=>{
                    if (allowAutomatic&&value===themeAutomaticLength) return themeAutomaticLength;
                    if (typeof value!=='string') throw new Error(`${label} debe ser una medida en px o "${themeAutomaticLength}".`);
                    const match=value.trim().match(/^(-?\d+(?:\.\d+)?)px$/i);
                    const number=match?Number(match[1]):NaN;
                    if (!Number.isFinite(number)||(!allowNegative&&number<=0)||number < -10000||number>10000) {
                        throw new Error(`${label} debe ser una medida válida en px.`);
                    }
                    return `${number}px`;
                };
                const audioSize=layout?.panelDeAudio;
                const lyricsSize=layout?.panelDeLetras;
                const compact=layout?.panelCompacto;
                const text=layout?.textoLetrasYCompacto;
                if (!audioSize||!lyricsSize||!compact||!text) throw new Error('Faltan opciones de tamaño, posición o texto en la disposición del tema.');
                const spacing=layout.separacionContadoresPx;
                const dividerScale=compact.posicionLineaDivisoraEscala;
                const playbackSide=compact.ladoReproduccion;
                const compactFullscreen=compact.pantallaCompleta;
                const fontScale=text.escala;
                if (!Number.isFinite(spacing)||spacing<0||spacing>1000) throw new Error('La separación de contadores debe ser un número entre 0 y 1000 px.');
                if (!Number.isFinite(dividerScale)||dividerScale<2.7) throw new Error('La escala del separador compacto debe ser un número igual o mayor que 2.7.');
                if (!['izquierda','derecha'].includes(playbackSide)) throw new Error('El lado de reproducción del panel compacto debe ser izquierda o derecha.');
                if ((theme.panelDeAudio.estilo==='compacto'&&typeof compactFullscreen!=='boolean')||(theme.panelDeAudio.estilo!=='compacto'&&compactFullscreen!==undefined)) {
                    throw new Error('La pantalla completa solo se guarda cuando el panel de audio está en modo compacto.');
                }
                const compactWidth=compact.ancho??lyricsSize.ancho;
                const compactHeight=compact.alto??lyricsSize.alto;
                if (!Number.isFinite(fontScale)||fontScale<0.1||fontScale>4) throw new Error('La escala del texto debe estar entre 0.1 y 4.');
                if (!['arriba','debajo'].includes(layout.controlesYTitulos)) throw new Error('La posición de los controles y títulos debe ser arriba o debajo de la barra.');
                const alignments={izquierda:'left',centro:'center',derecha:'right'};
                if (!alignments[text.alineacion]) throw new Error('La alineación debe ser izquierda, centro o derecha.');
                if (typeof text.color!=='string'||!themeColorPattern.test(text.color)) throw new Error('El color del texto debe estar en formato HEX (#RRGGBB).');
                validated.disposicion={
                    panelDeAudio:{
                        ancho:validateLength(audioSize.ancho,'Ancho del panel de audio'),
                        alto:validateLength(audioSize.alto,'Alto del panel de audio')
                    },
                    separacionContadoresPx:spacing,
                    controlesYTitulos:layout.controlesYTitulos,
                    panelDeLetras:{
                        ancho:validateLength(lyricsSize.ancho,'Ancho del panel de letras'),
                        alto:validateLength(lyricsSize.alto,'Alto del panel de letras'),
                        superior:validateLength(lyricsSize.superior,'Posición superior del panel de letras',{allowNegative:true}),
                        izquierda:validateLength(lyricsSize.izquierda,'Posición izquierda del panel de letras',{allowNegative:true})
                    },
                    panelCompacto:{ancho:validateLength(compactWidth,'Ancho del panel compacto'),alto:validateLength(compactHeight,'Alto del panel compacto'),posicionLineaDivisoraEscala:dividerScale,ladoReproduccion:playbackSide,pantallaCompleta:compactFullscreen??null},
                    textoLetrasYCompacto:{color:text.color.toLowerCase(),alineacion:alignments[text.alineacion],escala:fontScale}
                };
            if (theme.vinilo!==undefined) {
                const vinyl=theme.vinilo;
                const size=vinyl?.tamanoPx;
                const position=vinyl?.posicion;
                const left=position?.izquierdaPx;
                const top=position?.superiorPx;
                const border=vinyl?.borde;
                if (!Number.isFinite(size)||size<80||size>10000) throw new Error('El tamaño del vinilo debe estar entre 80 y 10000 px.');
                if (!Number.isFinite(left)||!Number.isFinite(top)||Math.abs(left)>100000||Math.abs(top)>100000) throw new Error('La posición del vinilo debe usar coordenadas válidas en px.');
                if (!['clasico','moderno','premium'].includes(vinyl.estilo)) throw new Error('El estilo del vinilo debe ser clásico, moderno o premium.');
                if (!border||!Number.isInteger(border.grosorPx)||border.grosorPx<0||border.grosorPx>30||typeof border.color!=='string'||!themeColorPattern.test(border.color)) {
                    throw new Error('El grosor o el color del borde del vinilo no es válido.');
                }
                if (!['detras','entre','delante'].includes(vinyl.capa)) throw new Error('La capa del vinilo debe ser detrás, entre cuadros o delante.');
                validated.vinilo={
                    tamanoPx:size,
                    posicion:{izquierdaPx:left,superiorPx:top},
                    estilo:({clasico:'classic',moderno:'modern',premium:'premium'})[vinyl.estilo],
                    borde:{grosorPx:border.grosorPx,color:border.color.toLowerCase()},
                    capa:({detras:'behind',entre:'between',delante:'front'})[vinyl.capa]
                };
            }
            return validated;
        }
        function sanitizeThemeFilename(name) {
            const sanitized=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,64);
            return sanitized||'tema';
        }
        themeSaveButton.addEventListener('click',async()=>{
            themeSaveButton.disabled=true;
            try {
                const filename=await saveFileAs(async filename=>{
                    const name=filename.replace(/\.zip$/i,'')||'Tema';
                    const theme=createCurrentTheme(name);
                    const files=[{name:'tema.json',bytes:new TextEncoder().encode(`${JSON.stringify(theme,null,2)}\n`)}];
                    const addImage=async(path,url,label)=>{
                        if(!url)return;
                        const response=await fetch(url);
                        if(!response.ok)throw new Error(`No se pudo leer ${label}.`);
                        const blob=await response.blob();
                        files.push({name:`imagenes/${path}.${songExtension('',blob.type||'image/png')}`,bytes:new Uint8Array(await blob.arrayBuffer())});
                    };
                    if(currentBackgroundMode==='image')await addImage('fondo',currentBackgroundImageUrl,'la imagen de fondo');
                    if(audioFrameImageState.mode==='image')await addImage('panel-audio',audioFrameImageState.url,'la imagen del panel de audio');
                    const compactImage=getCompactAudioSideImageState();
                    if(compactImage?.url)await addImage('panel-compacto',compactImage.url,'la imagen del panel compacto');
                    if(lyricsFrameImageState.mode==='image')await addImage('panel-letras',lyricsFrameImageState.url,'la imagen del panel de letras');
                    return songZip(files);
                },'tema.zip','Tema RecK','application/zip','.zip');
                const name=filename.replace(/\.zip$/i,'')||'Tema';
                showAppNotification({type:'success',content:`Tema «${name}» guardado en un archivo ZIP.`});
            } catch (error) {
                if (error.name!=='AbortError') showAppNotification({type:'error',content:error.message||'No se pudo guardar el tema.'});
            } finally {
                themeSaveButton.disabled=false;
            }
        });
        themeLoadButton.addEventListener('click',()=>themeFileInput.click());
        themeFileInput.addEventListener('change',async()=>{
            const file=themeFileInput.files?.[0];
            if (!file) return;
            try {
                const theme=validateTheme(JSON.parse(await file.text()));
                if (theme.fondo?.modo==='color') {
                    currentBackgroundMode='color';
                    currentBackgroundColors=theme.fondo.colores;
                    replaceColorSwatches(backgroundColorSwatches,currentBackgroundColors,'de fondo');
                    updateBackgroundColorIndexes();
                }
                if (theme.panelDeLetras) {
                    const panel=theme.panelDeLetras;
                    currentLyricsColors=panel.colores;
                    currentLyricsColor=currentLyricsColors[0];
                    currentLyricsOpacity=panel.opacidad/100;
                    replaceColorSwatches(lyricsColorSwatches,currentLyricsColors,'de letras',currentLyricsOpacity);
                    setLyricsFrameMode(panel.modo);
                    lyricsFillOpacity.value=String(panel.opacidad);
                    lyricsFillOpacity.dispatchEvent(new Event('input',{bubbles:true}));
                    lyricsFillBlur.value=String(panel.desenfoque);
                    lyricsFillBlur.dispatchEvent(new Event('input',{bubbles:true}));
                    currentLyricsGlowMode=({sombra:'shadow',luz:'light',desactivado:'off'})[panel.efecto];
                    currentLyricsGlowColor=panel.colorLuz;
                    reflectFrameEffect(lyricsShadowLightToggle,lyricsGlowColorTrigger,currentLyricsGlowMode,currentLyricsGlowColor);
                    applyLyricsShadowOrGlow();
                }
                if (theme.panelDeAudio) {
                    const audio=theme.panelDeAudio;
                    setAudioLayoutMode(audio.estilo);
                    if (audio.modoRelleno==='color') {
                        currentAudioColors=audio.colores;
                        currentAudioOpacity=audio.opacidad/100;
                        replaceColorSwatches(audioColorSwatches,currentAudioColors,'de audio',currentAudioOpacity);
                        setAudioFrameMode('color');
                        audioFillBlur.value=String(audio.desenfoque);
                        audioFillBlur.dispatchEvent(new Event('input',{bubbles:true}));
                        applyAudioFill();
                    }
                    currentAudioGlowMode=({sombra:'shadow',luz:'light',desactivado:'off'})[audio.efecto];
                    currentAudioGlowColor=audio.colorLuz;
                    reflectFrameEffect(audioShadowLightToggle,audioGlowColorTrigger,currentAudioGlowMode,currentAudioGlowColor);
                    applyAudioShadowOrGlow();
                    applyAudioTextColor(audio.colorTexto);
                }
                if (theme.extras) {
                    const extras=theme.extras;
                    const pause=extras.botonDePausa;
                    playButtonCircleVisible=pause.visible;
                    currentPlayButtonCircleColor=pause.colorCirculo;
                    currentAudioIconColor=pause.colorIconosAudio;
                    applyPlayButtonCircle();
                    applyAudioIconColor();
                    currentPlayButtonGlowMode=({sombra:'shadow',luz:'light',desactivado:'off'})[pause.efecto];
                    currentPlayButtonGlowColor=pause.colorLuz;
                    reflectFrameEffect(playButtonShadowLightToggle,playButtonGlowColorTrigger,currentPlayButtonGlowMode,currentPlayButtonGlowColor);
                    applyPlayButtonShadowOrGlow();

                    const progress=extras.barraDeProgreso;
                    currentProgressTrackMode=progress.estilo;
                    applyProgressTrackMode();
                    currentProgressColors=progress.colores;
                    replaceColorSwatches(progressColorSwatches,currentProgressColors,'del progreso');
                    applyProgressColors();
                    currentCounterThumbVisible=progress.circuloVisible;
                    currentCounterThumbColor=progress.colorCirculo;
                    counterThumbColorTrigger.style.backgroundColor=currentCounterThumbColor;
                    counterThumbColorTrigger.classList.toggle('hidden',!currentCounterThumbVisible);
                    seekbarThumb.hidden=!currentCounterThumbVisible;
                    seekbarThumb.style.display=currentCounterThumbVisible?'':'none';
                    compactSeekbarThumb.style.display=currentCounterThumbVisible?'':'none';
                    counterThumbToggle.textContent=currentCounterThumbVisible?'Visible':'Oculto';
                    counterThumbToggle.setAttribute('aria-pressed',String(currentCounterThumbVisible));
                    counterThumbToggle.setAttribute('aria-label',currentCounterThumbVisible?'Ocultar thumb de la barra de progreso':'Mostrar thumb de la barra de progreso');
                    seekbarThumb.style.backgroundColor=currentCounterThumbColor;
                    compactSeekbarThumb.style.backgroundColor=currentCounterThumbColor;

                    currentCounterColor=extras.rellenoContadores.color;
                    currentCounterOpacity=extras.rellenoContadores.opacidad/100;
                    applyCounterPillColor();
                }
                if (theme.disposicion) {
                    const layout=theme.disposicion;
                    applyThemeLength('--audio-width',layout.panelDeAudio.ancho);
                    applyThemeLength('--audio-height',layout.panelDeAudio.alto);
                    applyThemeLength('--letras-width',layout.panelDeLetras.ancho);
                    applyThemeLength('--letras-height',layout.panelDeLetras.alto);
                    applyThemeLength('--letras-top',layout.panelDeLetras.superior);
                    applyThemeLength('--letras-left',layout.panelDeLetras.izquierda);
                    applyThemeLength('--letras-width',layout.panelCompacto.ancho);
                    applyThemeLength('--letras-height',layout.panelCompacto.alto);
                    compactAudioFrame.style.setProperty('--compact-divider-offset-scale',String(layout.panelCompacto.posicionLineaDivisoraEscala));
                    if (theme.panelDeAudio.estilo==='compacto') fitCompactDividerToWidth(compactAudioFrame.clientWidth);
                    syncCompactDividerAria();
                    const playbackOnRight=layout.panelCompacto.ladoReproduccion==='derecha';
                    if (layout.panelCompacto.ladoReproduccion&&playbackOnRight!==compactAudioFrame.classList.contains('compact-sides-reversed')) {
                        compactSideToggle.click();
                    }
                    const shouldBeFullscreen=layout.panelCompacto.pantallaCompleta;
                    if (shouldBeFullscreen!==null&&shouldBeFullscreen!==document.body.classList.contains('compact-fullscreen')) {
                        compactFullscreenToggle.click();
                    }
                    setSharedControlsPosition(layout.controlesYTitulos==='debajo');

                    const text=layout.textoLetrasYCompacto;
                    applyLyricsTextColor(text.color);
                    const alignmentButton=lyricsAlignmentButtons.find(button=>button.dataset.lyricsAlign===text.alineacion);
                    if (alignmentButton&&alignmentButton.getAttribute('aria-pressed')!=='true') alignmentButton.click();
                    document.documentElement.style.setProperty('--lyrics-font-scale',String(text.escala));
                    updateLyricsLinePosition();
                    updateLyricsAlignmentControls();
                    rememberAudioScale();
                    rememberLyricsScale();

                    currentPillOffset=layout.separacionContadoresPx;
                    applyPillOffset();
                    updatePillOffset(layout.separacionContadoresPx);
                }
                if (theme.vinilo) {
                    const vinyl=theme.vinilo;
                    const settings={
                        left:`${vinyl.posicion.izquierdaPx}px`,
                        top:`${vinyl.posicion.superiorPx}px`,
                        transform:'none',
                        sizePx:vinyl.tamanoPx,
                        layer:vinyl.capa,
                        mode:vinyl.estilo,
                        spinning:activeVinylCover?.spinning??lastVinylCoverSettings?.spinning??false,
                        borderColor:vinyl.borde.color,
                        borderWidth:vinyl.borde.grosorPx
                    };
                    lastVinylCoverSettings=settings;
                    if (activeVinylCover) {
                        const active=activeVinylCover;
                        active.sizePx=settings.sizePx;
                        active.layer=settings.layer;
                        active.mode=settings.mode;
                        active.borderColor=settings.borderColor;
                        active.borderWidth=settings.borderWidth;
                        active.element.style.left=settings.left;
                        active.element.style.top=settings.top;
                        active.element.style.transform='none';
                        active.element.style.width=`${active.sizePx}px`;
                        active.element.style.zIndex=getCanvasObjectZIndex(active.layer);
                        active.element.classList.toggle('modern',active.mode==='modern');
                        active.disc.src=active.mode==='premium'?'icons/gold_vinyl.png':'icons/normal_vinyl.png';
                        applyVinylCoverBorder();
                        syncVinylCoverModeButton(active.mode);
                        vinylCoverBorderColor.style.backgroundColor=active.borderColor;
                        vinylCoverBorderWidth.value=String(active.borderWidth);
                        vinylCoverLayer.dataset.layer=active.layer;
                        const layerLabels={behind:'Detrás',between:'Entre cuadros',front:'Delante'};
                        vinylCoverLayer.setAttribute('aria-label',`Capa: ${layerLabels[active.layer]}`);
                        vinylCoverLayer.title=`Capa: ${layerLabels[active.layer]}`;
                    }
                }
                showAppNotification({type:'success',content:`Tema «${theme.nombre}» cargado.`});
            } catch (error) {
                showAppNotification({type:'error',content:error instanceof SyntaxError?'No se pudo leer el JSON. Revisa la sintaxis del archivo.':error.message||'No se pudo cargar el tema.'});
            } finally {
                themeFileInput.value='';
            }
        });
        const songSaveButton=document.getElementById('song-save-button');
        const songLoadButton=document.getElementById('song-load-button');
        const songFileInput=document.getElementById('song-file-input');
        const songEncoder=new TextEncoder();
        const songDecoder=new TextDecoder();
        const songCrcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}return table;})();
        function songCrc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=songCrcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
        function songZip(files){
            const viewOf=bytes=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
            const locals=[],centrals=[];let offset=0;
            for(const file of files){const name=songEncoder.encode(file.name),data=file.bytes,crc=songCrc32(data),local=new Uint8Array(30+name.length+data.length),lv=viewOf(local);
                lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);lv.setUint16(8,0,true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);local.set(name,30);local.set(data,30+name.length);locals.push(local);
                const central=new Uint8Array(46+name.length),cv=viewOf(central);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(10,0,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);central.set(name,46);centrals.push(central);offset+=local.length;
            }
            const centralSize=centrals.reduce((sum,item)=>sum+item.length,0),end=new Uint8Array(22),ev=viewOf(end);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
            return new Blob([...locals,...centrals,end],{type:'application/zip'});
        }
        async function songUnzip(file){
            const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);let eocd=-1;
            for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
            if(eocd<0)throw new Error('El archivo no contiene un ZIP válido.');
            const count=view.getUint16(eocd+10,true),directory=view.getUint32(eocd+16,true),files=new Map();let cursor=directory;
            if(count>5000)throw new Error('El ZIP contiene demasiados archivos.');
            for(let i=0;i<count;i++){if(view.getUint32(cursor,true)!==0x02014b50)throw new Error('El índice del ZIP está dañado.');const method=view.getUint16(cursor+10,true),crc=view.getUint32(cursor+16,true),compressed=view.getUint32(cursor+20,true),size=view.getUint32(cursor+24,true),nameLength=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),commentLength=view.getUint16(cursor+32,true),localOffset=view.getUint32(cursor+42,true),name=songDecoder.decode(bytes.subarray(cursor+46,cursor+46+nameLength));
                if(name.startsWith('/')||name.includes('..')||name.includes('\\')||files.has(name))throw new Error('El ZIP contiene una ruta de archivo no válida.');
                if(view.getUint32(localOffset,true)!==0x04034b50)throw new Error('Un archivo del ZIP está dañado.');const localName=view.getUint16(localOffset+26,true),localExtra=view.getUint16(localOffset+28,true),start=localOffset+30+localName+localExtra;let content=bytes.slice(start,start+compressed);
                if(method===8){if(typeof DecompressionStream==='undefined')throw new Error('Este navegador no puede descomprimir este ZIP.');content=new Uint8Array(await new Response(new Blob([content]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());}else if(method!==0)throw new Error('El ZIP usa un método de compresión no compatible.');
                if(content.length!==size||songCrc32(content)!==crc)throw new Error('La verificación de un archivo del ZIP falló.');files.set(name,content);cursor+=46+nameLength+extraLength+commentLength;
            }return files;
        }
        async function songBlobFromUrl(url){if(!url)throw new Error('Falta un archivo de imagen.');const response=await fetch(url);if(!response.ok)throw new Error('No se pudo leer un archivo de imagen.');const blob=await response.blob();return {bytes:new Uint8Array(await blob.arrayBuffer()),type:blob.type||'image/png'};}
        function songExtension(name,type=''){const fromName=name?.match(/\.([a-z0-9]{1,8})$/i)?.[1];if(fromName)return fromName.toLowerCase();return ({'image/jpeg':'jpg','image/svg+xml':'svg','audio/mpeg':'mp3','audio/mp4':'m4a','audio/ogg':'ogg','audio/wav':'wav','audio/webm':'webm','image/png':'png','image/webp':'webp'})[type]||'bin';}
        function songMimeForPath(path){const ext=path.split('.').pop().toLowerCase();return ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',bmp:'image/bmp',mp3:'audio/mpeg',m4a:'audio/mp4',ogg:'audio/ogg',wav:'audio/wav',webm:'audio/webm'})[ext]||'application/octet-stream';}
        songSaveButton.addEventListener('click',async()=>{
            const audioFile=audioInput.files?.[0];if(!audioFile){showAppNotification({type:'warning',content:'Carga una canción antes de guardarla. El ZIP debe incluir el audio.'});return;}
            songSaveButton.disabled=true;
            try{
                const files=[{name:'audio.'+songExtension(audioFile.name,audioFile.type),bytes:new Uint8Array(await audioFile.arrayBuffer())}],manifest={formato:'RecK canción',version:1,nombre:audioFile.name.replace(/\.[^.]+$/,''),audio:{archivo:files[0].name,nombre:audioFile.name,tipo:audioFile.type},imagenesLienzo:[],vinilo:null,letras:{texto:lyricsEditorPanel.value,titulos:{superiorIzquierda:addedTextTop.textContent,inferiorIzquierda:addedTextBottom.textContent,superiorDerecha:addedTextRightTop.textContent,inferiorDerecha:addedTextRightBottom.textContent},puntosControl:lyricsCheckpoints.map(point=>({...point})),puntoSeleccionado:selectedLyricsCheckpointTime,coloresEtiquetasCorchetes:[...lyricsTagStyles].map(([etiqueta,style])=>({etiqueta,color:style.color})),opacidadEtiquetas:lyricsTagOpacity,brilloEtiquetas:lyricsTagBrightness},imagenesPanelAudio:[]};
                for(let i=0;i<overlayImages.length;i++){const state=overlayImages[i],media=await songBlobFromUrl(state.url),name=`imagenes/lienzo-${String(i+1).padStart(3,'0')}.${songExtension('',media.type)}`,rect=state.element.getBoundingClientRect();files.push({name,bytes:media.bytes});manifest.imagenesLienzo.push({archivo:name,izquierdaPx:Math.round(rect.left*100)/100,superiorPx:Math.round(rect.top*100)/100,anchoPx:Math.round(rect.width*100)/100,capa:state.layer});}
                if(activeVinylCover){const state=activeVinylCover,media=await songBlobFromUrl(state.url),rect=state.element.getBoundingClientRect(),visible=rect.width>0,size=visible?rect.width:state.sizePx,coordinate=(axis,viewportSize)=>{if(visible)return rect[axis];const raw=state.element.style[axis]||'0px',value=parseFloat(raw)||0;return raw.trim().endsWith('%')?value*viewportSize/100-(state.element.style.transform.includes('-50%')?size/2:0):value;},name=`imagenes/vinilo.${songExtension('',media.type)}`;files.push({name,bytes:media.bytes});manifest.vinilo={archivo:name,tamanoPx:size,posicion:{izquierdaPx:coordinate('left',innerWidth),superiorPx:coordinate('top',innerHeight)},estilo:state.mode,giro:state.spinning,colorBorde:state.borderColor,grosorBorde:state.borderWidth,capa:state.layer};}
                for(const state of audioSideImageControls)if(state.url){const media=await songBlobFromUrl(state.url),name=`imagenes/panel-audio-${state.side}.${songExtension('',media.type)}`;files.push({name,bytes:media.bytes});manifest.imagenesPanelAudio.push({lado:state.side,archivo:name,forma:state.shape,giro:state.spinning});}
                files.push({name:'cancion.json',bytes:songEncoder.encode(JSON.stringify(manifest,null,2)+'\n')});const blob=songZip(files);await saveFileAs(blob,`${sanitizeThemeFilename(manifest.nombre)}.zip`,'Canción RecK','application/zip','.zip');showAppNotification({type:'success',content:'Canción guardada en un archivo ZIP.'});
            }catch(error){showAppNotification({type:'error',content:error.message||'No se pudo guardar la canción.'});}finally{songSaveButton.disabled=false;}
        });
        songLoadButton.addEventListener('click',()=>songFileInput.click());
        songFileInput.addEventListener('change',async()=>{
            const zip=songFileInput.files?.[0];if(!zip)return;
            try{
                const files=await songUnzip(zip),manifestBytes=files.get('cancion.json');if(!manifestBytes)throw new Error('El ZIP no contiene cancion.json.');const data=JSON.parse(songDecoder.decode(manifestBytes));if(data.formato!=='RecK canción'||data.version!==1)throw new Error('El archivo no es un proyecto de canción RecK compatible.');
                const getFile=(path)=>{if(typeof path!=='string'||!files.has(path))throw new Error('Falta un medio indicado en cancion.json.');return files.get(path);};
                const audioData=getFile(data.audio?.archivo);const audioFile=new File([audioData],data.audio.nombre||'audio.'+songExtension('',data.audio.tipo),{type:data.audio.tipo||'audio/mpeg'});
                if(activeVinylCover){lastVinylCoverSettings={left:activeVinylCover.element.style.left,top:activeVinylCover.element.style.top,transform:activeVinylCover.element.style.transform,sizePx:activeVinylCover.sizePx,layer:activeVinylCover.layer,mode:activeVinylCover.mode,spinning:activeVinylCover.spinning,borderColor:activeVinylCover.borderColor,borderWidth:activeVinylCover.borderWidth};activeVinylCover.element.remove();URL.revokeObjectURL(activeVinylCover.url);activeVinylCover=null;vinylCoverTrigger.classList.remove('hidden');mediaControlsGroup.classList.remove('single-control');}lastVinylCoverSettings=null;
                overlayImages.splice(0).forEach(state=>{state.element.remove();URL.revokeObjectURL(state.url);});activeOverlayImage=null;updateOverlayImageResizeBox();
                for(const state of audioSideImageControls){if(state.url)URL.revokeObjectURL(state.url);state.url='';state.image.removeAttribute('src');state.image.hidden=true;state.button.classList.remove('has-image','circle','spinning');state.shape='square';state.spinning=false;}syncAudioSideImageMargin();
                const transfer=new DataTransfer();transfer.items.add(audioFile);audioInput.files=transfer.files;const metaPromise=new Promise(resolve=>audioElement.addEventListener('loadedmetadata',resolve,{once:true}));audioInput.dispatchEvent(new Event('change',{bubbles:true}));await Promise.race([metaPromise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('El navegador no pudo abrir el audio del ZIP.')),15000))]);
                const lyric=data.letras||{};lyricsEditorPanel.value=lyric.texto||'';lyricsEditorPanel.dispatchEvent(new Event('input',{bubbles:true}));const titles=lyric.titulos||{};addedTextTop.textContent=titles.superiorIzquierda||'';addedTextBottom.textContent=titles.inferiorIzquierda||'';addedTextRightTop.textContent=titles.superiorDerecha||'';addedTextRightBottom.textContent=titles.inferiorDerecha||'';updateAllMarquees();
                if(Array.isArray(lyric.puntosControl)&&lyric.puntosControl.length)restoreLyricsCheckpointState(lyric.puntosControl,lyric.puntoSeleccionado??null);
                if(Array.isArray(lyric.coloresEtiquetasCorchetes)){lyricsTagStyles.clear();for(const tag of lyric.coloresEtiquetasCorchetes)if(typeof tag.etiqueta==='string'&&/^#[0-9a-f]{6}$/i.test(tag.color))lyricsTagStyles.set(normalizeLyricsTagLabel(tag.etiqueta),{color:tag.color,initialColor:tag.color});lyricsTagOpacity=Number.isFinite(Number(lyric.opacidadEtiquetas))?Number(lyric.opacidadEtiquetas):0.4;lyricsTagBrightness=Number.isFinite(Number(lyric.brilloEtiquetas))?Number(lyric.brilloEtiquetas):25;renderLyricsLines(lyricsEditorPanel.value);}
                for(const saved of data.imagenesLienzo||[]){const blobFile=new File([getFile(saved.archivo)],saved.archivo.split('/').pop(),{type:songMimeForPath(saved.archivo)}),inputTransfer=new DataTransfer();inputTransfer.items.add(blobFile);overlayImageInput.files=inputTransfer.files;const loaded=new Promise((resolve,reject)=>{const check=()=>{const state=overlayImages.at(-1);if(state?.element.complete&&state.element.naturalWidth)resolve(state);else setTimeout(check,25);};setTimeout(check,25);setTimeout(()=>reject(new Error('No se pudo cargar una imagen del lienzo.')),10000);});overlayImageInput.dispatchEvent(new Event('change',{bubbles:true}));const state=await loaded;state.element.style.left=`${saved.izquierdaPx}px`;state.element.style.top=`${saved.superiorPx}px`;state.element.style.width=`${saved.anchoPx}px`;state.baseWidth=saved.anchoPx;activeOverlayImage=state;setOverlayImageLayer(saved.capa||'front');}
                if(data.vinilo){const v=data.vinilo;lastVinylCoverSettings={left:`${v.posicion.izquierdaPx}px`,top:`${v.posicion.superiorPx}px`,transform:'none',sizePx:v.tamanoPx,layer:v.capa,mode:v.estilo,spinning:Boolean(v.giro),borderColor:v.colorBorde,borderWidth:v.grosorBorde};const f=new File([getFile(v.archivo)],v.archivo.split('/').pop(),{type:songMimeForPath(v.archivo)}),t=new DataTransfer();t.items.add(f);vinylCoverInput.files=t.files;const vinylPromise=new Promise((resolve,reject)=>{const check=()=>activeVinylCover?.cover.complete&&activeVinylCover.cover.naturalWidth?resolve():setTimeout(check,25);setTimeout(check,25);setTimeout(()=>reject(new Error('No se pudo cargar la imagen del vinilo.')),10000);});vinylCoverInput.dispatchEvent(new Event('change',{bubbles:true}));await vinylPromise;activeVinylCover.element.style.left=lastVinylCoverSettings.left;activeVinylCover.element.style.top=lastVinylCoverSettings.top;activeVinylCover.element.style.transform='none';activeVinylCover.element.style.width=`${v.tamanoPx}px`;activeVinylCover.sizePx=v.tamanoPx;activeVinylCover.layer=v.capa;activeVinylCover.mode=v.estilo;activeVinylCover.spinning=Boolean(v.giro);activeVinylCover.borderColor=v.colorBorde;activeVinylCover.borderWidth=v.grosorBorde;activeVinylCover.element.style.zIndex=getCanvasObjectZIndex(v.capa);activeVinylCover.element.classList.toggle('modern',v.estilo==='modern');activeVinylCover.art.classList.toggle('spinning',Boolean(v.giro));applyVinylCoverBorder();}
                for(const saved of data.imagenesPanelAudio||[]){const state=audioSideImageControls.find(item=>item.side===saved.lado);if(!state)continue;const f=new File([getFile(saved.archivo)],saved.archivo.split('/').pop(),{type:songMimeForPath(saved.archivo)}),t=new DataTransfer();t.items.add(f);const loaded=new Promise((resolve,reject)=>{const check=()=>state.url?resolve():setTimeout(check,25);setTimeout(check,25);setTimeout(()=>reject(new Error('No se pudo cargar una imagen del panel de audio.')),10000);});state.input.files=t.files;state.input.dispatchEvent(new Event('change',{bubbles:true}));await loaded;state.shape=saved.forma==='circle'?'circle':'square';state.spinning=Boolean(saved.giro);state.button.classList.toggle('circle',state.shape==='circle');state.button.classList.toggle('spinning',state.spinning);syncAudioSideImageMargin();}
                showAppNotification({type:'success',content:`Canción «${data.nombre||'sin nombre'}» cargada.`});
            }catch(error){showAppNotification({type:'error',content:error instanceof SyntaxError?'El cancion.json del ZIP no contiene JSON válido.':error.message||'No se pudo cargar la canción.'});}finally{songFileInput.value='';}
        });
        settingsSyncButtons.forEach(button=>button.addEventListener('click',e=>{
            e.stopPropagation();
            closeColorPicker();
            if (button.dataset.syncColors==='background') {
                if (currentBackgroundMode!=='color') {
                    backgroundImageFileInput.click();
                    return;
                }
                currentBackgroundMode='color';
                currentBackgroundColors=[...currentAudioColors];
                replaceColorSwatches(backgroundColorSwatches,currentBackgroundColors,'de fondo');
                updateBackgroundColorIndexes();
                applyBackgroundFill();
            } else if (button.dataset.syncColors==='lyrics') {
                if (lyricsFrameImageState.mode==='image') { button.imageInput?.click(); return; }
                currentLyricsColors=[...currentAudioColors];
                currentLyricsColor=currentLyricsColors[0];
                currentLyricsOpacity=currentAudioOpacity;
                replaceColorSwatches(lyricsColorSwatches,currentLyricsColors,'de letras',currentLyricsOpacity);
                applyLyricsFill();
                syncBlur(lyricsFillBlur,audioFillBlur);
                currentLyricsTextColor=currentAudioTextColor;
                applyLyricsTextColor();
                currentLyricsGlowMode=currentAudioGlowMode;
                currentLyricsGlowColor=currentAudioGlowColor;
                reflectFrameEffect(lyricsShadowLightToggle,lyricsGlowColorTrigger,currentLyricsGlowMode,currentLyricsGlowColor);
                applyLyricsShadowOrGlow();
            } else {
                if (audioFrameImageState.mode==='image') { button.imageInput?.click(); return; }
                currentAudioColors=[...currentLyricsColors];
                currentAudioOpacity=currentLyricsOpacity;
                replaceColorSwatches(audioColorSwatches,currentAudioColors,'de audio',currentAudioOpacity);
                applyAudioFill();
                syncBlur(audioFillBlur,lyricsFillBlur);
                currentAudioTextColor=currentLyricsTextColor;
                applyAudioTextColor();
                currentAudioGlowMode=currentLyricsGlowMode;
                currentAudioGlowColor=currentLyricsGlowColor;
                reflectFrameEffect(audioShadowLightToggle,audioGlowColorTrigger,currentAudioGlowMode,currentAudioGlowColor);
                applyAudioShadowOrGlow();
            }
        }));
        let draggedAudioColorButton=null, audioColorDropTarget=null, audioColorDropBefore=true, suppressAudioColorClick=false;
        function clearAudioColorDropGuide() {
            audioColorSwatches.querySelectorAll('.drop-before,.drop-after').forEach(button=>button.classList.remove('drop-before','drop-after'));
            audioColorDropTarget=null;
        }
        audioColorSwatches.addEventListener('dragstart',e=>{
            const button=e.target.closest('button[data-color-index]');
            if (!button) return;
            draggedAudioColorButton=button;
            suppressAudioColorClick=true;
            button.classList.add('color-dragging');
            e.dataTransfer.effectAllowed='move';
            e.dataTransfer.setData('text/plain',button.dataset.colorIndex);
        });
        audioColorSwatches.addEventListener('dragover',e=>{
            if (!draggedAudioColorButton) return;
            e.preventDefault();
            e.dataTransfer.dropEffect='move';
            clearAudioColorDropGuide();
            const buttons=[...audioColorSwatches.querySelectorAll('button[data-color-index]')].filter(button=>button!==draggedAudioColorButton);
            const next=buttons.find(button=>e.clientX<button.getBoundingClientRect().left+button.getBoundingClientRect().width/2);
            audioColorDropTarget=next || buttons.at(-1) || null;
            audioColorDropBefore=Boolean(next);
            if (audioColorDropTarget) audioColorDropTarget.classList.add(audioColorDropBefore?'drop-before':'drop-after');
        });
        audioColorSwatches.addEventListener('drop',e=>{
            if (!draggedAudioColorButton || !audioColorDropTarget) return;
            e.preventDefault();
            if (audioColorDropBefore) audioColorSwatches.insertBefore(draggedAudioColorButton,audioColorDropTarget);
            else audioColorDropTarget.after(draggedAudioColorButton);
            const buttons=[...audioColorSwatches.querySelectorAll('button[data-color-index]')];
            currentAudioColors=buttons.map(button=>button.dataset.color);
            buttons.forEach((button,index)=>{
                button.dataset.colorIndex=String(index);
                button.setAttribute('aria-label',index===0?'Elegir color principal del audio':`Elegir color de audio ${index+1}`);
                button.title=index===0?'Color principal':`Color ${index+1}`;
            });
            applyAudioFill();
            clearAudioColorDropGuide();
        });
        audioColorSwatches.addEventListener('dragend',()=>{
            draggedAudioColorButton?.classList.remove('color-dragging');
            draggedAudioColorButton=null;
            clearAudioColorDropGuide();
            setTimeout(()=>{suppressAudioColorClick=false;},600);
        });
        function openAudioStopPicker(index,anchor) {
            openColorPicker({
                anchor, preview:anchor, color:currentAudioColors[index], opacity:currentAudioOpacity,
                resetColor:currentAudioColors[index], resetOpacity:currentAudioOpacity, showOpacity:false,
                onChange:(color,opacity)=>{
                    currentAudioColors[index]=color.toLowerCase();
                    anchor.dataset.color=color.toLowerCase();
                    currentAudioOpacity=opacity;
                    applyAudioFill();
                },
                onDelete:currentAudioColors.length>1 ? ()=>{
                    currentAudioColors.splice(index,1);
                    anchor.remove();
                    [...audioColorSwatches.querySelectorAll('button[data-color-index]')].forEach((button,nextIndex)=>{
                        button.dataset.colorIndex=String(nextIndex);
                        button.setAttribute('aria-label',nextIndex===0?'Elegir color principal del audio':`Elegir color de audio ${nextIndex+1}`);
                        button.title=nextIndex===0?'Color principal':`Color ${nextIndex+1}`;
                    });
                    applyAudioFill();
                    closeColorPicker();
                } : null
            });
        }
        audioColorSwatches.addEventListener('click',e=>{
            if (suppressAudioColorClick) {
                suppressAudioColorClick=false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            const button=e.target.closest('button[data-color-index]');
            if (!button) return;
            e.stopPropagation();
            if (lyricsColorPicker.classList.contains('open') && activeColorPickerOptions?.anchor===button) {
                closeColorPicker();
                return;
            }
            openAudioStopPicker(Number(button.dataset.colorIndex),button);
        });
        audioColorAdd.addEventListener('click',e=>{
            e.stopPropagation();
            if (currentAudioColors.length>=3) return;
            const index=currentAudioColors.push('#ffffff')-1;
            const button=document.createElement('button');
            button.type='button'; button.classList.add('color-choice-button'); button.draggable=true; button.dataset.colorIndex=String(index); button.dataset.color='#ffffff';
            button.setAttribute('aria-label',`Elegir color de audio ${index+1}`); button.title=`Color ${index+1}`;
            button.style.backgroundColor='#ffffff';
            audioColorSwatches.append(button);
            applyAudioFill();
        });
        let colorDragPointer = null;
        function moveColorIndicator(clientX, clientY) {
            const rect=lyricsColorCanvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const x=Math.max(0,Math.min(rect.width,clientX-rect.left));
            const y=Math.max(0,Math.min(rect.height,clientY-rect.top));
            pickerSaturation=x/rect.width;
            pickerValue=1-y/rect.height;
            setPickerColor(colorFromPicker());
        }
        lyricsColorCanvas.addEventListener('pointerdown',e=>{
            if (e.pointerType==='mouse' && e.button!==0) return;
            e.preventDefault();
            colorDragPointer=e.pointerId;
            lyricsColorCanvas.setPointerCapture(colorDragPointer);
            moveColorIndicator(e.clientX,e.clientY);
        });
        document.addEventListener('pointermove',e=>{
            if (e.pointerId===colorDragPointer) moveColorIndicator(e.clientX,e.clientY);
        });
        function finishColorDrag(e) {
            if (e.pointerId!==colorDragPointer) return;
            colorDragPointer=null;
        }
        document.addEventListener('pointerup',finishColorDrag);
        document.addEventListener('pointercancel',finishColorDrag);
        lyricsColorHue.addEventListener('input',()=>{pickerHue=Number(lyricsColorHue.value);setPickerColor(colorFromPicker());});
        lyricsColorOpacity.addEventListener('input',()=>{
            pickerOpacity=Number(lyricsColorOpacity.value)/100;
            setPickerColor(colorFromPicker());
        });
        lyricsColorBrightness.addEventListener('input',()=>{
            pickerBrightness=Number(lyricsColorBrightness.value);
            setPickerColor(colorFromPicker());
        });
        lyricsColorHue.addEventListener('pointerdown',e=>{
            if(e.button!==0) return;
            const updateHueFromPointer=event=>{
                const rect=lyricsColorHue.getBoundingClientRect();
                const fraction=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));
                pickerHue=fraction*360;
                lyricsColorHue.value=String(Math.round(pickerHue));
                setPickerColor(colorFromPicker());
            };
            updateHueFromPointer(e);
            const stop=()=>{window.removeEventListener('pointermove',updateHueFromPointer);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);};
            window.addEventListener('pointermove',updateHueFromPointer);
            window.addEventListener('pointerup',stop,{once:true});
            window.addEventListener('pointercancel',stop,{once:true});
        });
        function normalizeLyricsColorHex(value) {
            const trimmed=value.trim();
            if (!/^#?[\da-f]{6}$/i.test(trimmed)) return null;
            return (trimmed.startsWith('#') ? trimmed : `#${trimmed}`).toLowerCase();
        }
        lyricsColorHex.addEventListener('input',()=>{
            const hex=normalizeLyricsColorHex(lyricsColorHex.value);
            if(hex) setPickerColor(hex,true,true);
        });
        lyricsColorHex.addEventListener('blur',()=>{
            const hex=normalizeLyricsColorHex(lyricsColorHex.value);
            if(hex) setPickerColor(hex,true,true);
            else lyricsColorHex.value=colorFromPicker().toUpperCase();
        });
        lyricsColorHex.addEventListener('keydown',event=>{
            if(event.key!=='Enter') return;
            event.preventDefault();
            lyricsColorHex.blur();
        });
        lyricsColorReset.addEventListener('click',()=>{
            if (!activeColorPickerOptions) return;
            pickerOpacity=activeColorPickerOptions.resetOpacity;
            pickerBrightness=activeColorPickerOptions.resetBrightness;
            setPickerColor(activeColorPickerOptions.resetColor,true,true);
        });
        lyricsColorDelete.addEventListener('click',()=>activeColorPickerOptions?.onDelete?.());
        window.addEventListener('resize',()=>{if(lyricsColorPicker.classList.contains('open')) positionColorPicker();});
        document.addEventListener('pointerdown', (e) => {
            if (e.target.closest?.('#discord-profile-confirmation')) return;
            if (e.target.closest?.('#creator-discord-badge')) return;
            // La barra personalizada es un control del contenedor desplazable, no un clic externo al menú.
            if (e.target.closest?.('.winui-scrollbar')) return;
            if (settingsSectionsMenu.classList.contains('open') &&
                !settingsSectionsMenu.contains(e.target) && !settingsTrigger.contains(e.target)) {
                closeSettingsSectionsMenu();
            }
            if (lyricsColorPicker.classList.contains('open')) {
                if (lyricsColorPicker.contains(e.target) || e.target.closest('.lyrics-tag')) return;
                if (activeColorPickerOptions?.anchor===e.target || activeColorPickerOptions?.anchor.contains(e.target)) return;
                const isInteractiveTarget=e.target.closest('button, input, select, textarea, a, [role="button"], [tabindex], .btn-upload-audio, .lyrics-move-handle, .resize-handle-top, .resize-handle-bottom, .resize-handle-left, .resize-handle-right, .resize-handle-top-left, .resize-handle-top-right, .resize-handle-bottom-left, .resize-handle-bottom-right, .guide-line, .guide-corner-svg');
                closeColorPicker();
                if (!isInteractiveTarget) return;
            }
            const lyricsMenuOpen = !lyricsSettingsMenu.classList.contains('hidden');
            const audioMenuOpen = !audioSettingsMenu.classList.contains('hidden');
            const counterMenuOpen = !counterSettingsMenu.classList.contains('hidden');
            const backgroundMenuOpen = !backgroundSettingsMenu.classList.contains('hidden');
            const managementMenuOpen = !managementSettingsMenu.classList.contains('hidden');
            const isCounter = e.target.closest('#time-elapsed, #time-remaining, #compact-time-elapsed, #compact-time-remaining');
            if (lyricsMenuOpen && !lyricsSettingsMenu.contains(e.target)) closeLyricsSettingsMenu();
            if (audioMenuOpen && !audioSettingsMenu.contains(e.target)) closeAudioSettingsMenu();
            if (counterMenuOpen && !counterSettingsMenu.contains(e.target) && !isCounter) closeCounterSettingsMenu();
            if (backgroundMenuOpen && !backgroundSettingsMenu.contains(e.target)) closeBackgroundSettingsMenu();
            if (managementMenuOpen && !managementSettingsMenu.contains(e.target)) closeManagementSettingsMenu();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            if (lyricsColorPicker.classList.contains('open')) {
                closeColorPicker();
                return;
            }
            if (lyricsEditorBackdrop.classList.contains('open')) {
                closeLyricsEditor();
                return;
            }
            if (settingsShortcutsMenu.classList.contains('open')) {
                closeSettingsDrawer(settingsShortcutsMenu, { preserveBackdrop: true });
                openSettingsDrawer(settingsHelpMenu);
                return;
            }
            if (settingsHelpMenu.classList.contains('open')) {
                closeSettingsDrawer(settingsHelpMenu, { preserveBackdrop: true });
                openSettingsSectionsMenu();
                return;
            }
            if (settingsSectionsMenu.classList.contains('open')) {
                closeSettingsSectionsMenu();
                return;
            }
            if (!lyricsSettingsMenu.classList.contains('hidden')) closeLyricsSettingsMenu();
            if (!audioSettingsMenu.classList.contains('hidden')) closeAudioSettingsMenu();
            if (!counterSettingsMenu.classList.contains('hidden')) closeCounterSettingsMenu();
            if (!backgroundSettingsMenu.classList.contains('hidden')) closeBackgroundSettingsMenu();
            if (!managementSettingsMenu.classList.contains('hidden')) closeManagementSettingsMenu();
            overlayImageMenu.classList.add('hidden');
            vinylCoverMenu.classList.add('hidden');
            audioSideImageMenu.classList.add('hidden');
        });
        lyricsEditorBackdrop.addEventListener('click', (e) => {
            if (e.target === lyricsEditorBackdrop) closeLyricsEditor();
        });
        lyricsEditorPanel.addEventListener('input', () => {
            renderLyricsLines(lyricsEditorPanel.value);
        });
        renderLyricsLines(lyricsEditorPanel.value);
        function updateLyricsEditorGuide(e) {
            if (!lyricsEditorBackdrop.classList.contains('open') || isLyricsEditorResizing) {
                lyricsEditorGuideLine.style.display = 'none';
                return;
            }
            const rect = lyricsEditorPanelWrap.getBoundingClientRect();
            const leftSide = lyricsEditorBackdrop.classList.contains('left-side');
            const edgeX = leftSide ? rect.right : rect.left;
            const nearEdge = Math.abs(e.clientX - edgeX) <= window.innerWidth * 0.03 &&
                e.clientY >= rect.top && e.clientY <= rect.bottom;
            if (nearEdge) {
                lyricsEditorGuideLine.style.height = `${Math.min(window.innerWidth * 0.08, rect.height)}px`;
                lyricsEditorGuideLine.style.display = 'block';
            } else {
                lyricsEditorGuideLine.style.display = 'none';
            }
        }
        lyricsEditorResizeHandle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isLyricsEditorResizing = true;
            lyricsEditorGuideLine.style.display = 'none';
            const startX = e.clientX;
            const startWidth = lyricsEditorPanelWrap.getBoundingClientRect().width;
            const leftSide = lyricsEditorBackdrop.classList.contains('left-side');
            const resize = (moveEvent) => {
                const minWidth = Math.min(250, window.innerWidth);
                const delta = leftSide ? moveEvent.clientX - startX : startX - moveEvent.clientX;
                const width = Math.max(minWidth, Math.min(window.innerWidth, startWidth + delta));
                document.documentElement.style.setProperty('--lyrics-editor-width', `${width}px`);
            };
            const stop = () => {
                isLyricsEditorResizing = false;
                window.removeEventListener('pointermove', resize);
                window.removeEventListener('pointerup', stop);
                window.removeEventListener('pointercancel', stop);
                updateLyricsEditorGuide(latestLyricsPointer || { clientX: -1e6, clientY: -1e6 });
            };
            window.addEventListener('pointermove', resize);
            window.addEventListener('pointerup', stop);
            window.addEventListener('pointercancel', stop);
        });
        const audioViewportScale = {
            viewportWidth: window.innerWidth,
            width: btnUploadAudio.getBoundingClientRect().width,
            height: btnUploadAudio.getBoundingClientRect().height,
            bottom: window.innerHeight - btnUploadAudio.getBoundingClientRect().bottom
        };

        const lyricsRect = cuadroDeLetras.getBoundingClientRect();
        const lyricsViewportScale = {
            vw: window.innerWidth, vh: window.innerHeight,
            top: lyricsRect.top, left: lyricsRect.left,
            width: lyricsRect.width, height: lyricsRect.height
        };

        function rememberAudioScale() {
            const rect = (cuadroDeAudio.classList.contains('hidden') ? btnUploadAudio : cuadroDeAudio).getBoundingClientRect();
            audioViewportScale.viewportWidth = window.innerWidth;
            audioViewportScale.width = rect.width;
            audioViewportScale.height = rect.height;
            audioViewportScale.bottom = window.innerHeight - rect.bottom;
        }

        function scaleAudioWithViewport() {
            const nextViewportWidth = window.innerWidth;
            if (!audioViewportScale.viewportWidth || !nextViewportWidth) return;

            const scale = nextViewportWidth / audioViewportScale.viewportWidth;
            if (Math.abs(scale - 1) < 0.001) return;

            audioViewportScale.width *= scale;
            audioViewportScale.height *= scale;
            audioViewportScale.bottom *= scale;
            audioViewportScale.viewportWidth = nextViewportWidth;

            document.documentElement.style.setProperty('--audio-width', `${audioViewportScale.width}px`);
            document.documentElement.style.setProperty('--audio-height', `${audioViewportScale.height}px`);
            document.documentElement.style.setProperty('--audio-bottom', `${audioViewportScale.bottom}px`);
        }

        function rememberLyricsScale() {
            const compactVisible = document.body.classList.contains('audio-mode-compact')
                && getComputedStyle(compactAudioFrame).display !== 'none';
            const target = compactVisible ? compactAudioFrame : cuadroDeLetras;
            const rect = target.getBoundingClientRect();
            const compactCollapseHeight = compactVisible
                ? parseFloat(getComputedStyle(compactAudioFrame).getPropertyValue('--compact-empty-row-collapse-height')) || 0
                : 0;
            Object.assign(lyricsViewportScale, {
                vw: window.innerWidth, vh: window.innerHeight,
                top: rect.top, left: rect.left, width: rect.width, height: rect.height + compactCollapseHeight
            });
        }

        function scaleLyricsWithViewport() {
            const sx = window.innerWidth / lyricsViewportScale.vw;
            const sy = window.innerHeight / lyricsViewportScale.vh;
            if (sx === 1 && sy === 1) return;
            lyricsViewportScale.left *= sx; lyricsViewportScale.width *= sx;
            lyricsViewportScale.top *= sy; lyricsViewportScale.height *= sy;
            lyricsViewportScale.vw = window.innerWidth; lyricsViewportScale.vh = window.innerHeight;
            for (const key of ['top', 'left', 'width', 'height']) {
                document.documentElement.style.setProperty(`--letras-${key}`, `${lyricsViewportScale[key]}px`);
            }
        }

        function formatTime(seconds) {
            if (isNaN(seconds) || seconds < 0) return "00:00";
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`;
        }

        let isResizingActive = false;

        const springFeedbackAnimations = new WeakMap();
        function playSpringPressFeedback(button) {
            springFeedbackAnimations.get(button)?.cancel();
            const isSettingsStyleButton = button.classList.contains('management-action-button') || button.classList.contains('settings-section-button');
            const scale = isSettingsStyleButton ? 0.9 : button.classList.contains('btn-upload-audio') ? 0.98 : button.classList.contains('settings-back-button') ? 0.96 : 0.82;
            const animation = button.animate([
                { scale: String(scale), offset: 0 },
                { scale: String(scale), offset: 0.28 },
                { scale: '1', offset: 1 }
            ], {
                duration: 220,
                easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                fill: 'none'
            });
            springFeedbackAnimations.set(button, animation);
        }

        function initSpringButtons() {
            const springButtons = document.querySelectorAll('.spring-btn');
            const canceledSpringClicks = new Set();
            document.addEventListener('click', (e) => {
                if (!e.detail) return;
                const button = e.target instanceof Element ? e.target.closest('.spring-btn') : null;
                if (!button || !canceledSpringClicks.has(button)) return;
                canceledSpringClicks.delete(button);
                e.preventDefault();
                e.stopImmediatePropagation();
            }, true);

            springButtons.forEach(btn => {
                let activePointerId = null;
                let normalBounds = null;

                const pressDown = (e) => {
                    if (e.target.classList.contains('resize-handle-top') ||
                        e.target.classList.contains('resize-handle-bottom') ||
                        e.target.classList.contains('resize-handle-left') ||
                        e.target.classList.contains('resize-handle-right') ||
                        e.target.classList.contains('resize-handle-top-left') ||
                        e.target.classList.contains('resize-handle-top-right') ||
                        e.target.classList.contains('resize-handle-bottom-left') ||
                        e.target.classList.contains('resize-handle-bottom-right') ||
                        e.target.classList.contains('guide-line') ||
                        e.target.classList.contains('guide-corner-svg')) {
                        return;
                    }
                    if (isResizingActive || activePointerId !== null) return;
                    activePointerId = e.pointerId;
                    normalBounds = btn.getBoundingClientRect();
                    try { btn.setPointerCapture(e.pointerId); } catch {}
                    btn.classList.add('pressed');
                };

                const isInsideNormalBounds = (e) => normalBounds &&
                    e.clientX >= normalBounds.left && e.clientX <= normalBounds.right &&
                    e.clientY >= normalBounds.top && e.clientY <= normalBounds.bottom;

                const pressUp = (e) => {
                    if (activePointerId === null || e.pointerId !== activePointerId) return;
                    const activated = isInsideNormalBounds(e);
                    btn.classList.remove('pressed');
                    playSpringPressFeedback(btn);
                    if (!activated) {
                        canceledSpringClicks.add(btn);
                        setTimeout(() => canceledSpringClicks.delete(btn), 0);
                    }
                    try {
                        if (btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId);
                    } catch {}
                    activePointerId = null;
                    normalBounds = null;
                };

                const pointerLeave = (e) => {
                    if (activePointerId !== e.pointerId || isInsideNormalBounds(e)) return;
                    btn.classList.remove('pressed');
                };

                const pressCancel = (e) => {
                    if (activePointerId !== e.pointerId) return;
                    btn.classList.remove('pressed');
                    playSpringPressFeedback(btn);
                    activePointerId = null;
                    normalBounds = null;
                };

                btn.addEventListener('pointerdown', pressDown);
                btn.addEventListener('pointerup', pressUp);
                btn.addEventListener('pointerleave', pointerLeave);
                btn.addEventListener('pointercancel', pressCancel);
            });
        }

        document.addEventListener('DOMContentLoaded', initSpringButtons);

        function updateButtonVisibility(button, textElements) {
            if (textElements.every(text => text.textContent.trim() === '')) {
                button.classList.remove('btn-add-invisible');
                return;
            }

            button.classList.add('btn-add-invisible');
        }

        let marqueeAnimations = { top: null, bottom: null };

        function startMarqueeAnimation(wrapper, track, key, reverse = false) {
            if (marqueeAnimations[key]) {
                marqueeAnimations[key].cancel();
                marqueeAnimations[key] = null;
            }
            track.style.transform = 'translateX(0px)';

            const containerWidth = wrapper.clientWidth;
            const textWidth = track.scrollWidth;

            if (textWidth > containerWidth && containerWidth > 0) {
                const distance = textWidth - containerWidth;
                const moveDuration = (distance / 30) * 1000; 

                const startX = 0;
                const endX = -distance;
                const forwardDuration = moveDuration;
                const returnDuration = 0;
                const totalDuration = 3000 + forwardDuration + 3000 + returnDuration;
                const forwardEnd = 3000 + forwardDuration;
                const returnStart = forwardEnd + 3000;
                const keyframes = [
                    { transform: `translateX(${startX}px)`, offset: 0 },
                    { transform: `translateX(${startX}px)`, offset: 3000 / totalDuration },
                    { transform: `translateX(${endX}px)`, offset: forwardEnd / totalDuration },
                    { transform: `translateX(${endX}px)`, offset: returnStart / totalDuration },
                    { transform: `translateX(${startX}px)`, offset: 1 }
                ];

                marqueeAnimations[key] = track.animate(keyframes, {
                    duration: totalDuration,
                    iterations: Infinity,
                    easing: 'linear',
                    iterationComposite: 'replace'
                });
            }
        }

        function syncCompactTextBounds() {
            const controlsRect = compactAudioControls.getBoundingClientRect();
            if (!controlsRect.width) return;

            const centerInset = controlsRect.width * 0.5 + 8;
            const leftInset = Math.max(8, centerInset);
            const rightInset = Math.max(8, centerInset);
            compactAudioControls.style.setProperty('--compact-text-left-inner-inset', `${leftInset}px`);
            compactAudioControls.style.setProperty('--compact-text-right-inner-inset', `${rightInset}px`);
        }

        function updateAllMarquees() {
            syncCompactTextBounds();
            updateTextLayout(addedTextContainer, addedTextTop, addedTextBottom, wrapperTop, wrapperBottom);
            updateTextLayout(addedTextContainerRight, addedTextRightTop, addedTextRightBottom, wrapperRightTop, wrapperRightBottom);
            updateButtonVisibility(btnAdd, [addedTextTop, addedTextBottom]);
            updateButtonVisibility(btnAddRight, [addedTextRightTop, addedTextRightBottom]);
            compactAddedTextTop.textContent = addedTextTop.textContent;
            compactAddedTextBottom.textContent = addedTextBottom.textContent;
            compactAddedTextRightTop.textContent = addedTextRightTop.textContent;
            compactAddedTextRightBottom.textContent = addedTextRightBottom.textContent;
            compactAudioFrame.classList.toggle('has-compact-added-text', [
                compactAddedTextTop,
                compactAddedTextBottom,
                compactAddedTextRightTop,
                compactAddedTextRightBottom
            ].some(text => text.textContent.trim() !== ''));
            updateTextLayout(compactAddedTextContainer, compactAddedTextTop, compactAddedTextBottom, compactWrapperTop, compactWrapperBottom);
            updateTextLayout(compactAddedTextContainerRight, compactAddedTextRightTop, compactAddedTextRightBottom, compactWrapperRightTop, compactWrapperRightBottom);
            updateButtonVisibility(compactBtnAddLeft, [compactAddedTextTop, compactAddedTextBottom]);
            updateButtonVisibility(compactBtnAddRight, [compactAddedTextRightTop, compactAddedTextRightBottom]);
            startMarqueeAnimation(wrapperTop, trackTop, 'top');
            startMarqueeAnimation(wrapperBottom, trackBottom, 'bottom');
            startMarqueeAnimation(wrapperRightTop, trackRightTop, 'rightTop', true);
            startMarqueeAnimation(wrapperRightBottom, trackRightBottom, 'rightBottom', true);
            startMarqueeAnimation(compactWrapperTop, compactTrackTop, 'compactTop');
            startMarqueeAnimation(compactWrapperBottom, compactTrackBottom, 'compactBottom');
            startMarqueeAnimation(compactWrapperRightTop, compactTrackRightTop, 'compactRightTop', true);
            startMarqueeAnimation(compactWrapperRightBottom, compactTrackRightBottom, 'compactRightBottom', true);
        }

        function updateTextLayout(container, topText, bottomText, topWrapper, bottomWrapper) {
            const hasTop = topText.textContent.trim() !== '';
            const hasBottom = bottomText.textContent.trim() !== '';
            container.classList.toggle('single-line', hasTop !== hasBottom);
            container.style.pointerEvents = hasTop || hasBottom ? 'auto' : 'none';
            topWrapper.classList.toggle('empty', !hasTop);
            bottomWrapper.classList.toggle('empty', !hasBottom);
        }

        btnAdd.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isResizingActive) return;
            editingTextSide = 'left';
            inputTop.value = addedTextTop.textContent;
            inputBottom.value = addedTextBottom.textContent;
            openTextDialog(btnAdd);
        });

        btnAddRight.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isResizingActive) return;
            editingTextSide = 'right';
            inputTop.value = addedTextRightTop.textContent;
            inputBottom.value = addedTextRightBottom.textContent;
            openTextDialog(btnAddRight);
        });

        const openTextEditor = (side, e) => {
            e.stopPropagation();
            if (isResizingActive) return;
            editingTextSide = side;
            inputTop.value = side === 'right' ? addedTextRightTop.textContent : addedTextTop.textContent;
            inputBottom.value = side === 'right' ? addedTextRightBottom.textContent : addedTextBottom.textContent;
            openTextDialog(e.currentTarget);
        };

        addedTextContainer.addEventListener('click', (e) => openTextEditor('left', e));
        addedTextContainerRight.addEventListener('click', (e) => openTextEditor('right', e));
        compactBtnAddLeft.addEventListener('click', (e) => openTextEditor('left', e));
        compactBtnAddRight.addEventListener('click', (e) => openTextEditor('right', e));
        compactAddedTextContainer.addEventListener('click', (e) => openTextEditor('left', e));
        compactAddedTextContainerRight.addEventListener('click', (e) => openTextEditor('right', e));
        [
            [compactAddedTextContainer, 'left'],
            [compactAddedTextContainerRight, 'right']
        ].forEach(([container, side]) => container.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openTextEditor(side, event);
        }));

        btnModalCancel.addEventListener('click', (e) => {
            e.stopPropagation();
            inputTop.value = editingTextSide === 'right' ? addedTextRightTop.textContent : addedTextTop.textContent;
            inputBottom.value = editingTextSide === 'right' ? addedTextRightBottom.textContent : addedTextBottom.textContent;
            closeTextDialog();
        });

        const preventEnter = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnModalAccept.click();
            }
        };

        inputTop.addEventListener('keydown', preventEnter);
        inputBottom.addEventListener('keydown', preventEnter);
        inputTop.addEventListener('keydown', event => {
            if (event.key !== 'ArrowDown') return;
            event.preventDefault();
            inputBottom.focus();
        });
        inputBottom.addEventListener('keydown', event => {
            if (event.key !== 'ArrowUp') return;
            event.preventDefault();
            inputTop.focus();
        });

        btnModalAccept.addEventListener('click', (e) => {
            e.stopPropagation();
            const textTop = inputTop.value;
            const textBottom = inputBottom.value;

            const targetTop = editingTextSide === 'right' ? addedTextRightTop : addedTextTop;
            const targetBottom = editingTextSide === 'right' ? addedTextRightBottom : addedTextBottom;
            targetTop.textContent = textTop;
            targetBottom.textContent = textBottom;

            closeTextDialog(() => setTimeout(updateAllMarquees, 50));
        });
        updateAllMarquees();
        const compactTextBoundsObserver = new ResizeObserver(() => updateAllMarquees());
        compactTextBoundsObserver.observe(compactAudioControls);
        compactTextBoundsObserver.observe(compactPlaybackButtons);

        btnUploadAudio.addEventListener('click', (e) => {
            if (isResizingActive || 
                e.target.classList.contains('resize-handle-top') ||
                e.target.classList.contains('resize-handle-bottom') ||
                e.target.classList.contains('resize-handle-left') ||
                e.target.classList.contains('resize-handle-right') ||
                e.target.classList.contains('resize-handle-top-left') ||
                e.target.classList.contains('resize-handle-top-right') ||
                e.target.classList.contains('resize-handle-bottom-left') ||
                e.target.classList.contains('resize-handle-bottom-right')) {
                return;
            }
            audioInput.click();
        });

        audioInput.addEventListener('change', (event) => {
            if (event.target.files && event.target.files.length > 0) {
                const file = event.target.files[0];
                document.body.classList.remove('audio-loaded');
                clearMovementHistory();
                lyricsCheckpoints = [{ time: 0, row: -1, explicit: false }];
                selectedLyricsCheckpointTime = null;
                seekbarCheckpoints.replaceChildren();
                clearTimeout(endedResetTimer);
                endedResetTimer = null;
                audioElement.pause();
                audioElement.src = URL.createObjectURL(file);
                btnUploadAudio.classList.add('hidden');
                cuadroDeAudio.classList.remove('hidden');
                deleteAudioTrigger.classList.remove('hidden');
                updateLyricsAlignmentControls();
                setTimeout(updateAllMarquees, 100);
            }
        });

        const audioDeleteConfirmation = document.getElementById('audio-delete-confirmation');
        const audioDeleteCancel = document.getElementById('audio-delete-cancel');
        const audioDeleteConfirm = document.getElementById('audio-delete-confirm');
        const audioDeleteDialog = audioDeleteConfirmation.querySelector('.audio-delete-dialog');
        let lastPointerPosition = null;
        let audioDeleteClosing = false;
        document.addEventListener('pointermove', event => { lastPointerPosition = { x: event.clientX, y: event.clientY }; }, { passive: true });
        function closeAudioDeleteConfirmation(afterClose) {
            if (audioDeleteClosing) return;
            audioDeleteClosing = true;
            audioDeleteConfirmation.classList.remove('is-opening');
            audioDeleteConfirmation.classList.add('is-closing');
            const finishClose = event => {
                if (event?.type === 'animationend' && (event.target !== audioDeleteDialog || event.animationName !== 'audio-delete-spring-out')) return;
                audioDeleteDialog.removeEventListener('animationend', finishClose);
                audioDeleteDialog.removeEventListener('animationcancel', finishClose);
                audioDeleteConfirmation.classList.add('hidden');
                audioDeleteConfirmation.classList.remove('is-closing');
                audioDeleteClosing = false;
                const triggerRect = deleteAudioTrigger.getBoundingClientRect();
                const pointerOverTrigger = lastPointerPosition && lastPointerPosition.x >= triggerRect.left && lastPointerPosition.x <= triggerRect.right && lastPointerPosition.y >= triggerRect.top && lastPointerPosition.y <= triggerRect.bottom;
                deleteAudioTrigger.dataset.tooltipSuppressed = 'true';
                deleteAudioTrigger.focus();
                if (!pointerOverTrigger) delete deleteAudioTrigger.dataset.tooltipSuppressed;
                afterClose?.();
            };
            audioDeleteDialog.addEventListener('animationend', finishClose);
            audioDeleteDialog.addEventListener('animationcancel', finishClose);
        }
        deleteAudioTrigger.addEventListener('click', e => {
            e.stopPropagation();
            if (e.pointerType) lastPointerPosition = { x: e.clientX, y: e.clientY };
            deleteAudioTrigger.dataset.tooltipSuppressed = 'true';
            const triggerRect = deleteAudioTrigger.getBoundingClientRect();
            audioDeleteConfirmation.style.setProperty('--audio-delete-start-x', `${triggerRect.left + triggerRect.width / 2 - innerWidth / 2}px`);
            audioDeleteConfirmation.style.setProperty('--audio-delete-start-y', `${triggerRect.top + triggerRect.height / 2 - innerHeight / 2}px`);
            audioDeleteConfirmation.classList.remove('hidden');
            audioDeleteConfirmation.classList.remove('is-opening');
            audioDeleteConfirmation.classList.remove('is-closing');
            audioDeleteClosing = false;
            void audioDeleteConfirmation.offsetWidth;
            audioDeleteConfirmation.classList.add('is-opening');
            audioDeleteCancel.focus();
        });
        audioDeleteCancel.addEventListener('click', closeAudioDeleteConfirmation);
        audioDeleteConfirmation.addEventListener('click', event => {
            if (event.target === audioDeleteConfirmation) closeAudioDeleteConfirmation();
        });
        audioDeleteConfirmation.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeAudioDeleteConfirmation();
            }
        });
        audioDeleteConfirm.addEventListener('click', () => {
            closeAudioDeleteConfirmation(() => {
                clearTimeout(endedResetTimer);
                endedResetTimer = null;
                audioElement.pause();
                document.body.classList.remove('audio-loaded');
                seekbarCheckpoints.replaceChildren();
                selectedLyricsCheckpointTime = null;
                iconPause.classList.add('hidden');
                iconPlay.classList.remove('hidden');
                if (audioElement.src.startsWith('blob:')) URL.revokeObjectURL(audioElement.src);
                audioElement.removeAttribute('src');
                audioElement.load();
                audioInput.value = '';
                timeElapsedEl.textContent = '00:00';
                timeRemainingEl.textContent = '00:00';
                updateSliderPosition(0);
                cuadroDeAudio.classList.add('hidden');
                btnUploadAudio.classList.remove('hidden');
                deleteAudioTrigger.classList.add('hidden');
                updateLyricsAlignmentControls();
            });
        });

        const discordBadge = document.getElementById('creator-discord-badge');
        const discordProfileConfirmation = document.getElementById('discord-profile-confirmation');
        const discordProfileDialog = discordProfileConfirmation.querySelector('.discord-profile-dialog');
        const discordProfileCancel = document.getElementById('discord-profile-cancel');
        const discordProfileAccept = document.getElementById('discord-profile-accept');
        let discordProfileClosing = false;
        function closeDiscordProfileConfirmation(restoreFocus = true) {
            if (discordProfileClosing) return;
            discordProfileClosing = true;
            discordProfileConfirmation.classList.remove('is-opening');
            discordProfileConfirmation.classList.add('is-closing');
            const finishClose = event => {
                if (event.type === 'animationend' && (event.target !== discordProfileDialog || event.animationName !== 'audio-delete-spring-out')) return;
                discordProfileDialog.removeEventListener('animationend', finishClose);
                discordProfileDialog.removeEventListener('animationcancel', finishClose);
                discordProfileConfirmation.classList.add('hidden');
                discordProfileConfirmation.classList.remove('is-closing');
                discordProfileClosing = false;
                if (restoreFocus) discordBadge.focus();
            };
            discordProfileDialog.addEventListener('animationend', finishClose);
            discordProfileDialog.addEventListener('animationcancel', finishClose);
        }
        discordBadge.addEventListener('click', event => {
            event.preventDefault();
            if (discordProfileClosing || !discordProfileConfirmation.classList.contains('hidden')) return;
            const badgeRect = discordBadge.getBoundingClientRect();
            discordProfileConfirmation.style.setProperty('--audio-delete-start-x', `${badgeRect.left + badgeRect.width / 2 - innerWidth / 2}px`);
            discordProfileConfirmation.style.setProperty('--audio-delete-start-y', `${badgeRect.top + badgeRect.height / 2 - innerHeight / 2}px`);
            discordProfileConfirmation.classList.remove('hidden', 'is-closing', 'is-opening');
            void discordProfileConfirmation.offsetWidth;
            discordProfileConfirmation.classList.add('is-opening');
            discordProfileCancel.focus();
        });
        discordProfileCancel.addEventListener('click', closeDiscordProfileConfirmation);
        discordProfileConfirmation.addEventListener('click', event => {
            if (event.target === discordProfileConfirmation) closeDiscordProfileConfirmation();
        });
        discordProfileConfirmation.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closeDiscordProfileConfirmation();
            }
        });
        discordProfileAccept.addEventListener('click', () => {
            if (discordProfileClosing) return;
            window.open(discordBadge.href, '_blank', 'noopener,noreferrer');
            closeDiscordProfileConfirmation(false);
        });

        function syncOverlayImageControls() {
            if (!activeOverlayImage) return;
            activeOverlayImage.layer = normalizeCanvasLayer(activeOverlayImage.layer);
            activeOverlayImage.element.style.zIndex = getCanvasObjectZIndex(activeOverlayImage.layer);
            updateOverlayImageResizeBox();
            const labels = { behind: 'Detras', between: 'Entre cuadros', front: 'Delante' };
            overlayImageLayer.dataset.layer = activeOverlayImage.layer;
            overlayImageLayer.setAttribute('aria-label', `Capa: ${labels[activeOverlayImage.layer]}`);
            overlayImageLayer.title = `Capa: ${labels[activeOverlayImage.layer]}`;
        }
        function setOverlayImageLayer(layer) {
            if (!activeOverlayImage) return;
            activeOverlayImage.layer = normalizeCanvasLayer(layer);
            activeOverlayImage.element.style.zIndex = getCanvasObjectZIndex(activeOverlayImage.layer);
            syncOverlayImageControls();
        }
        function positionOverlayMenu(x, y) {
            const rect = overlayImageMenu.getBoundingClientRect();
            overlayImageMenu.style.left = `${Math.max(8, Math.min(x, innerWidth - rect.width - 8))}px`;
            overlayImageMenu.style.top = `${Math.max(8, Math.min(y + 12, innerHeight - rect.height - 8))}px`;
        }
        function positionOverlayImageMenu() {
            const menuRect = overlayImageMenu.getBoundingClientRect();
            const imageRect = activeOverlayImage.element.getBoundingClientRect();
            const edge = 8;
            const x = Math.max(edge, Math.min(imageRect.left, innerWidth - menuRect.width - edge));
            const y = Math.max(edge, Math.min(imageRect.bottom + edge, innerHeight - menuRect.height - edge));
            overlayImageMenu.style.left = `${x}px`;
            overlayImageMenu.style.top = `${y}px`;
        }
        function openVinylCoverMenu() {
            if (!activeVinylCover) return;
            overlayImageMenu.classList.add('hidden');
            syncVinylCoverModeButton(activeVinylCover.mode);
            vinylCoverSpin.setAttribute('aria-pressed', String(activeVinylCover.spinning));
            const spinLabel = activeVinylCover.spinning ? 'Pausar giro' : 'Iniciar giro';
            vinylCoverSpin.setAttribute('aria-label', spinLabel);
            vinylCoverSpin.title = spinLabel;
            vinylCoverSpinPlay.classList.toggle('hidden', activeVinylCover.spinning);
            vinylCoverSpinPause.classList.toggle('hidden', !activeVinylCover.spinning);
            vinylCoverBorderColor.style.backgroundColor = activeVinylCover.borderColor;
            vinylCoverBorderWidth.value = String(activeVinylCover.borderWidth);
            activeVinylCover.layer = normalizeCanvasLayer(activeVinylCover.layer);
            activeVinylCover.element.style.zIndex = getCanvasObjectZIndex(activeVinylCover.layer);
            vinylCoverLayer.dataset.layer = activeVinylCover.layer;
            const labels = { behind: 'Detras', between: 'Entre cuadros', front: 'Delante' };
            vinylCoverLayer.setAttribute('aria-label', `Capa: ${labels[activeVinylCover.layer]}`);
            vinylCoverLayer.title = `Capa: ${labels[activeVinylCover.layer]}`;
            vinylCoverMenu.classList.remove('hidden');
            const menuRect = vinylCoverMenu.getBoundingClientRect();
            const vinylRect = activeVinylCover.element.getBoundingClientRect();
            const edge = 8;
            const menuWithDeleteTabHeight = menuRect.height + 51;
            const left = Math.max(edge, Math.min(vinylRect.right - menuRect.width, innerWidth - menuRect.width - edge));
            const top = Math.max(edge, Math.min(vinylRect.top, innerHeight - menuWithDeleteTabHeight - edge));
            vinylCoverMenu.style.left = `${left}px`;
            vinylCoverMenu.style.top = `${top}px`;
        }
        function removeActiveVinylCover() {
            if (!activeVinylCover) return;
            const rect=activeVinylCover.element.getBoundingClientRect();
            lastVinylCoverSettings = {
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                transform: 'none',
                sizePx: rect.width,
                layer: activeVinylCover.layer,
                mode: activeVinylCover.mode,
                spinning: activeVinylCover.spinning,
                borderColor: activeVinylCover.borderColor,
                borderWidth: activeVinylCover.borderWidth
            };
            activeVinylCover.element.remove();
            URL.revokeObjectURL(activeVinylCover.url);
            activeVinylCover = null;
            vinylCoverMenu.classList.add('hidden');
            vinylCoverTrigger.classList.remove('hidden');
            mediaControlsGroup.classList.remove('single-control');
            vinylCoverTrigger.setAttribute('aria-label', 'Cargar tapa de vinilo');
        }
        vinylCoverReplace.addEventListener('click', () => {
            if (activeVinylCover) vinylCoverInput.click();
        });
        vinylCoverDelete.addEventListener('click', removeActiveVinylCover);
        vinylCoverMode.addEventListener('click', () => {
            if (!activeVinylCover) return;
            activeVinylCover.mode = { classic: 'premium', premium: 'modern', modern: 'classic' }[activeVinylCover.mode];
            activeVinylCover.element.classList.toggle('modern', activeVinylCover.mode === 'modern');
            activeVinylCover.renderCover();
            activeVinylCover.disc.src = activeVinylCover.mode === 'premium' ? 'icons/gold_vinyl.png' : 'icons/normal_vinyl.png';
            syncVinylCoverModeButton(activeVinylCover.mode);
        });
        vinylCoverSpin.addEventListener('click', () => {
            if (!activeVinylCover) return;
            activeVinylCover.spinning = !activeVinylCover.spinning;
            activeVinylCover.art.classList.toggle('spinning', activeVinylCover.spinning);
            vinylCoverSpin.setAttribute('aria-pressed', String(activeVinylCover.spinning));
            const spinLabel = activeVinylCover.spinning ? 'Pausar giro' : 'Iniciar giro';
            vinylCoverSpin.setAttribute('aria-label', spinLabel);
            vinylCoverSpin.title = spinLabel;
            vinylCoverSpinPlay.classList.toggle('hidden', activeVinylCover.spinning);
            vinylCoverSpinPause.classList.toggle('hidden', !activeVinylCover.spinning);
        });
        function applyVinylCoverBorder() {
            if (!activeVinylCover) return;
            activeVinylCover.element.style.setProperty('--vinyl-border-color', activeVinylCover.borderColor);
            activeVinylCover.element.style.setProperty('--vinyl-border-width', `${activeVinylCover.borderWidth}px`);
        }
        vinylCoverBorderColor.addEventListener('click', event => {
            event.stopPropagation();
            if (!activeVinylCover) return;
            if (lyricsColorPicker.classList.contains('open') && activeColorPickerOptions?.anchor === vinylCoverBorderColor) {
                closeColorPicker();
                return;
            }
            openColorPicker({
                anchor: vinylCoverBorderColor,
                preview: vinylCoverBorderColor,
                color: activeVinylCover.borderColor,
                resetColor: activeVinylCover.borderColor,
                showOpacity: false,
                onChange: color => {
                    activeVinylCover.borderColor = color.toLowerCase();
                    vinylCoverBorderColor.style.backgroundColor = activeVinylCover.borderColor;
                    applyVinylCoverBorder();
                }
            });
        });
        vinylCoverBorderWidth.addEventListener('input', () => {
            if (!activeVinylCover) return;
            activeVinylCover.borderWidth = Number(vinylCoverBorderWidth.value);
            applyVinylCoverBorder();
        });
        vinylCoverLayer.addEventListener('click', () => {
            if (!activeVinylCover) return;
            const nextLayer = getNextCanvasLayer(activeVinylCover.layer);
            activeVinylCover.layer = nextLayer;
            activeVinylCover.element.style.zIndex = getCanvasObjectZIndex(nextLayer);
            const labels = { behind: 'Detras', between: 'Entre cuadros', front: 'Delante' };
            vinylCoverLayer.dataset.layer = nextLayer;
            vinylCoverLayer.setAttribute('aria-label', `Capa: ${labels[nextLayer]}`);
            vinylCoverLayer.title = `Capa: ${labels[nextLayer]}`;
        });
        function openOverlayImageMenu() {
            overlayImageMenuActions.classList.remove('hidden');
            lyricsParenthesesControls.classList.add('hidden');
            overlayImageMenu.classList.remove('hidden');
            positionOverlayImageMenu();
        }
        function openParenthesesTagMenu(tag) {
            activeParenthesesLabel = tag.dataset.parenthesesLabel;
            activeParenthesesTag = tag;
            const style = getLyricsParenthesesStyle(activeParenthesesLabel);
            lyricsParenthesesBackground.style.backgroundColor = style.background;
            lyricsParenthesesText.style.backgroundColor = style.color;
            lyricsParenthesesOpacity.value = String(Math.round(style.opacity * 100));
            overlayImageMenuActions.classList.add('hidden');
            lyricsParenthesesControls.classList.remove('hidden');
            overlayImageMenu.classList.remove('hidden');
            const rect = tag.getBoundingClientRect();
            positionOverlayMenu(rect.left, rect.bottom);
        }
        function updateParenthesesTagStyle(property, value) {
            if (activeParenthesesLabel === null) return;
            const style = getLyricsParenthesesStyle(activeParenthesesLabel);
            style[property] = value;
            [lyricsLinesTrack,compactLyricsTrack].forEach(track=>track.querySelectorAll('.lyrics-parentheses-tag').forEach(tag => {
                if (tag.dataset.parenthesesLabel === activeParenthesesLabel) {
                    applyLyricsParenthesesStyle(tag, activeParenthesesLabel, style);
                }
            }));
        }
        lyricsParenthesesOpacity.addEventListener('input', () => updateParenthesesTagStyle('opacity', Number(lyricsParenthesesOpacity.value) / 100));
        overlayImageTrigger.addEventListener('click', () => overlayImageInput.click());
        vinylCoverTrigger.addEventListener('click', () => {
            vinylCoverInput.click();
        });
        vinylCoverInput.addEventListener('change', () => {
            const file = vinylCoverInput.files?.[0];
            vinylCoverInput.value = '';
            if (!file) return;
            if (activeVinylCover) {
                const state = activeVinylCover;
                const previousUrl = state.url;
                const replacementUrl = URL.createObjectURL(file);
                state.cover.onload = () => {
                    URL.revokeObjectURL(previousUrl);
                    state.cover.onload = null;
                    state.cover.onerror = null;
                };
                state.cover.onerror = () => {
                    URL.revokeObjectURL(replacementUrl);
                    state.url = previousUrl;
                    state.cover.src = previousUrl;
                    state.cover.onload = null;
                    state.cover.onerror = null;
                };
                state.url = replacementUrl;
                state.cover.src = replacementUrl;
                return;
            }
            const url = URL.createObjectURL(file);
            const element = document.createElement('div');
            const art = document.createElement('div');
            const cover = document.createElement('img');
            const coverCanvas = document.createElement('canvas');
            const disc = document.createElement('img');
            element.className = 'vinyl-cover';
            art.className = 'vinyl-cover-art';
            const settings = lastVinylCoverSettings;
            if (settings) {
                element.style.left = settings.left;
                element.style.top = settings.top;
                element.style.transform = settings.transform;
            } else {
                element.style.left = '50%';
                element.style.top = '50%';
                element.style.transform = 'translate(-50%, -50%)';
            }
            cover.alt = '';
            cover.className = 'vinyl-cover-image';
            cover.hidden = true;
            coverCanvas.className = 'vinyl-cover-image';
            const renderCover = () => {
                if (!cover.complete || !cover.naturalWidth) return;
                const rect = coverCanvas.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                const pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
                const width = Math.max(1, Math.round(rect.width * pixelRatio));
                const height = Math.max(1, Math.round(rect.height * pixelRatio));
                if (coverCanvas.width !== width || coverCanvas.height !== height) {
                    coverCanvas.width = width;
                    coverCanvas.height = height;
                }
                const context = coverCanvas.getContext('2d');
                context.imageSmoothingEnabled = true;
                context.imageSmoothingQuality = 'high';
                context.clearRect(0, 0, width, height);
                const sourceRatio = cover.naturalWidth / cover.naturalHeight;
                const targetRatio = width / height;
                let sourceX = 0, sourceY = 0, sourceWidth = cover.naturalWidth, sourceHeight = cover.naturalHeight;
                if (sourceRatio > targetRatio) {
                    sourceWidth = cover.naturalHeight * targetRatio;
                    sourceX = (cover.naturalWidth - sourceWidth) / 2;
                } else {
                    sourceHeight = cover.naturalWidth / targetRatio;
                    sourceY = (cover.naturalHeight - sourceHeight) / 2;
                }
                context.drawImage(cover, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
            };
            cover.addEventListener('load', renderCover);
            cover.src = url;
            disc.className = 'vinyl-disc';
            disc.alt = '';
            disc.src = settings?.mode === 'premium' ? 'icons/gold_vinyl.png' : 'icons/normal_vinyl.png';
            art.append(cover, coverCanvas, disc);
            element.appendChild(art);
            const edgeGuide = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            edgeGuide.setAttribute('viewBox', '0 0 100 100');
            edgeGuide.setAttribute('aria-hidden', 'true');
            edgeGuide.classList.add('vinyl-edge-guide');
            const edgeGuidePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            edgeGuide.appendChild(edgeGuidePath);
            element.appendChild(edgeGuide);
            document.body.appendChild(element);
            const initialSize = parseFloat(getComputedStyle(element).width);
            activeVinylCover = {
                element, art, cover, coverCanvas, disc, url, renderCover,
                sizePx: settings?.sizePx ?? initialSize,
                layer: normalizeCanvasLayer(settings?.layer ?? 'front'),
                mode: settings?.mode ?? 'classic',
                spinning: settings?.spinning ?? false,
                borderColor: settings?.borderColor ?? '#ffffff',
                borderWidth: settings?.borderWidth ?? 0
            };
            if (settings) element.style.width = `${activeVinylCover.sizePx}px`;
            new ResizeObserver(renderCover).observe(element);
            element.style.zIndex = getCanvasObjectZIndex(activeVinylCover.layer);
            element.classList.toggle('modern', activeVinylCover.mode === 'modern');
            art.classList.toggle('spinning', activeVinylCover.spinning);
            applyVinylCoverBorder();
            vinylCoverTrigger.classList.add('hidden');
            mediaControlsGroup.classList.add('single-control');

            let drag = null;
            let menuWasOpenOnPress = false;
            const updateVinylResizeCursor = (event, rect = element.getBoundingClientRect()) => {
                const angle = Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2));
                const octant = Math.round(angle / (Math.PI / 4));
                const cursors = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
                element.style.cursor = cursors[(octant + 8) % 8];
            };
            const updateEdgeGuide = (event, rect = element.getBoundingClientRect()) => {
                const radius = rect.width / 2;
                const x = event.clientX - rect.left - radius;
                const y = event.clientY - rect.top - radius;
                const distance = Math.hypot(x, y);
                const nearEdge = distance > radius - 58 && distance <= radius + 180;
                element.classList.toggle('edge-near', nearEdge);
                element.classList.toggle('edge-resize-ready', distance >= radius - 12 && distance <= radius + 90);
                if (element.classList.contains('edge-resize-ready')) updateVinylResizeCursor(event, rect);
                else element.style.cursor = '';
                if (!nearEdge) return false;
                const angle = Math.atan2(y, x);
                const guideRadius = 50;
                const span = 0.31;
                const x1 = 50 + Math.cos(angle - span) * guideRadius;
                const y1 = 50 + Math.sin(angle - span) * guideRadius;
                const x2 = 50 + Math.cos(angle + span) * guideRadius;
                const y2 = 50 + Math.sin(angle + span) * guideRadius;
                const largeArc = span * 2 > Math.PI ? 1 : 0;
                edgeGuidePath.setAttribute('d', `M ${x1} ${y1} A ${guideRadius} ${guideRadius} 0 ${largeArc} 1 ${x2} ${y2}`);
                return distance >= radius - 25;
            };
            window.addEventListener('pointermove', event => {
                if (!drag) updateEdgeGuide(event);
            });
            element.addEventListener('pointerdown', event => {
                if (event.button !== 0) return;
                event.preventDefault();
                menuWasOpenOnPress = !vinylCoverMenu.classList.contains('hidden');
                vinylCoverMenu.classList.add('hidden');
                const rect = element.getBoundingClientRect();
                const dxFromCenter = event.clientX - (rect.left + rect.width / 2);
                const dyFromCenter = event.clientY - (rect.top + rect.height / 2);
                const pointerRadius = Math.hypot(dxFromCenter, dyFromCenter);
                const startsResize = pointerRadius >= rect.width / 2 - 12 && pointerRadius <= rect.width / 2 + 90;
                element.style.transform = 'none';
                element.style.left = `${rect.left}px`;
                element.style.top = `${rect.top}px`;
                drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, dx: 0, dy: 0, moved: false, resizing: startsResize, size: rect.width, startRadius: Math.hypot(dxFromCenter, dyFromCenter) };
                element.classList.toggle('edge-resizing', startsResize);
                if (startsResize) updateVinylResizeCursor(event, rect);
                element.setPointerCapture(event.pointerId);
            });
            element.addEventListener('pointermove', event => {
                if (!drag) {
                    updateEdgeGuide(event);
                    return;
                }
                if (drag.id !== event.pointerId) return;
                drag.dx = event.clientX - drag.x;
                drag.dy = event.clientY - drag.y;
                if (Math.hypot(drag.dx, drag.dy) > 4) drag.moved = true;
                if (drag.resizing) {
                    const radius = Math.hypot(event.clientX - (drag.left + drag.size / 2), event.clientY - (drag.top + drag.size / 2));
                    const nextSize = Math.max(80, drag.size + (radius - drag.startRadius) * 2);
                    element.style.width = `${nextSize}px`;
                    element.style.left = `${drag.left + (drag.size - nextSize) / 2}px`;
                    element.style.top = `${drag.top + (drag.size - nextSize) / 2}px`;
                    element.classList.add('edge-resizing');
                    updateVinylResizeCursor(event);
                    updateEdgeGuide(event);
                } else {
                    element.style.transform = `translate3d(${drag.dx}px, ${drag.dy}px, 0)`;
                }
            });
            const stopDrag = event => {
                if (drag?.id !== event.pointerId) return;
                const finishedDrag = drag;
                drag = null;
                element.classList.remove('edge-resizing');
                element.style.cursor = '';
                if (finishedDrag.resizing) {
                    activeVinylCover.sizePx = element.getBoundingClientRect().width;
                } else {
                    element.style.left = `${finishedDrag.left + finishedDrag.dx}px`;
                    element.style.top = `${finishedDrag.top + finishedDrag.dy}px`;
                    element.style.transform = 'none';
                }
                if (event.type === 'pointerup' && !finishedDrag.moved && !finishedDrag.resizing && !menuWasOpenOnPress) openVinylCoverMenu();
                menuWasOpenOnPress = false;
            };
            element.addEventListener('pointerup', stopDrag);
            element.addEventListener('pointercancel', stopDrag);
            element.addEventListener('pointerleave', () => {
                if (!drag) element.classList.remove('edge-near');
            });
        });
        overlayImageInput.addEventListener('change', () => {
            const file = overlayImageInput.files?.[0];
            if (!file) return;
            const element = document.createElement('img');
            const state = { element, url: URL.createObjectURL(file), baseWidth: 0, layer: 'front' };
            element.className = 'overlay-image';
            element.draggable = false;
            element.onload = () => {
                const maxWidth = innerWidth * 0.3;
                const fitWidth = element.naturalHeight
                    ? innerHeight * 0.4 * element.naturalWidth / element.naturalHeight
                    : maxWidth;
                state.baseWidth = Math.max(1, Math.min(element.naturalWidth, maxWidth, fitWidth));
                element.style.width = `${state.baseWidth}px`;
                const margin = Math.min(32, innerWidth * 0.05, innerHeight * 0.05);
                element.style.left = `${margin}px`;
                element.style.top = `${margin}px`;
                updateOverlayImageResizeBox();
            };
            element.src = state.url;
            document.body.appendChild(element);
            overlayImages.push(state);
            activeOverlayImage = state;
            overlayImageInput.value = '';
            setOverlayImageLayer('front');
            syncOverlayImageControls();
            overlayImageMenu.classList.add('hidden');
            element.addEventListener('pointerdown', event => {
                if (event.button !== 0) return;
                event.preventDefault();
                const imageMenuWasOpen = !overlayImageMenu.classList.contains('hidden')
                    && !overlayImageMenuActions.classList.contains('hidden')
                    && activeOverlayImage === state;
                activeOverlayImage = state;
                syncOverlayImageControls();
                overlayImageMenu.classList.add('hidden');
                overlayImageDragged = false;
                const rect = element.getBoundingClientRect();
                element.style.transform = 'none';
                element.style.left = `${rect.left}px`;
                element.style.top = `${rect.top}px`;
                overlayImageResizeBox.style.transform = 'none';
                overlayImageDrag = { image: state, id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, dx: 0, dy: 0, menuWasOpen: imageMenuWasOpen };
                element.setPointerCapture(event.pointerId);
            });
            element.addEventListener('pointermove', event => {
                if (!overlayImageDrag || overlayImageDrag.image !== state || event.pointerId !== overlayImageDrag.id) return;
                overlayImageDrag.dx = event.clientX - overlayImageDrag.x;
                overlayImageDrag.dy = event.clientY - overlayImageDrag.y;
                if (Math.hypot(overlayImageDrag.dx, overlayImageDrag.dy) > 4) overlayImageDragged = true;
                element.style.transform = `translate3d(${overlayImageDrag.dx}px, ${overlayImageDrag.dy}px, 0)`;
                overlayImageResizeBox.style.transform = `translate3d(${overlayImageDrag.dx}px, ${overlayImageDrag.dy}px, 0)`;
            });
            const finishOverlayImageDrag = event => {
                if (!overlayImageDrag || overlayImageDrag.image !== state || event.pointerId !== overlayImageDrag.id) return;
                const finishedDrag = overlayImageDrag;
                overlayImageDrag = null;
                element.style.left = `${finishedDrag.left + finishedDrag.dx}px`;
                element.style.top = `${finishedDrag.top + finishedDrag.dy}px`;
                element.style.transform = 'none';
                overlayImageResizeBox.style.transform = 'none';
                updateOverlayImageResizeBox();
                if (event.type === 'pointerup' && !overlayImageDragged && !finishedDrag.menuWasOpen) {
                    activeOverlayImage = state;
                    syncOverlayImageControls();
                    openOverlayImageMenu();
                }
                centerOverlayImageIfFullyOutside(element);
            };
            element.addEventListener('pointerup', finishOverlayImageDrag);
            element.addEventListener('pointercancel', finishOverlayImageDrag);
        });
        overlayImageLayer.addEventListener('click', () => {
            const nextLayer = getNextCanvasLayer(overlayImageLayer.dataset.layer);
            setOverlayImageLayer(nextLayer);
        });
        overlayImageDelete.addEventListener('click', () => {
            if (!activeOverlayImage) return;
            const index = overlayImages.indexOf(activeOverlayImage);
            if (index >= 0) overlayImages.splice(index, 1);
            URL.revokeObjectURL(activeOverlayImage.url);
            activeOverlayImage.element.remove();
            activeOverlayImage = overlayImages.at(-1) || null;
            overlayImageMenu.classList.add('hidden');
            if (activeOverlayImage) syncOverlayImageControls();
            else updateOverlayImageResizeBox();
        });
        document.addEventListener('pointerdown', event => {
            if (!overlayImageMenu.contains(event.target) && !lyricsColorPicker.contains(event.target) && !event.target.closest('.overlay-image, .lyrics-parentheses-tag')) overlayImageMenu.classList.add('hidden');
            if (!vinylCoverMenu.contains(event.target) && !lyricsColorPicker.contains(event.target) && !event.target.closest('.vinyl-cover')) vinylCoverMenu.classList.add('hidden');
            if (!audioSideImageMenu.contains(event.target) && !event.target.closest('.audio-side-image-button')) audioSideImageMenu.classList.add('hidden');
        });
        function togglePlayPause() {
            if (audioElement.paused) {
                audioElement.play();
            } else {
                audioElement.pause();
            }
        }
        document.addEventListener('keydown', event => {
            const target = event.target;
            const isCompactFullscreenHotkey = event.key.toLowerCase() === 'f' && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey && document.body.classList.contains('audio-mode-compact');
            const isCompactModeToggleFocused = target instanceof HTMLElement && target.closest('#compact-fullscreen-toggle, #compact-side-toggle');
            if (target instanceof HTMLElement && (
                target.isContentEditable ||
                target.matches('input, textarea, select, button, a, [role="button"], [tabindex]')
            ) && !(isCompactFullscreenHotkey && isCompactModeToggleFocused)) return;
            if (isCompactFullscreenHotkey) {
                event.preventDefault();
                compactFullscreenToggle.click();
                return;
            }
            if (event.key.toLowerCase() === 't' && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                lyricsEditorTrigger.click();
                return;
            }
            if (event.key.toLowerCase() === 'u' && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                checkpointVisibilityTrigger.click();
                return;
            }
            const isSpace = event.code === 'Space';
            if ((!isSpace && event.key.toLowerCase() !== 'k') || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
            event.preventDefault();
            if (!isResizingActive) togglePlayPause();
        });

        btnPlayPause.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isResizingActive) togglePlayPause();
        });
        compactPlayPauseButton.addEventListener('click',e=>{
            e.stopPropagation();
            if (!isResizingActive) togglePlayPause();
        });

        btnRewind10.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isResizingActive) audioElement.currentTime = Math.max(0, audioElement.currentTime - 10);
        });
        compactRewindButton.addEventListener('click', e => {
            e.stopPropagation();
            if (!isResizingActive) audioElement.currentTime = Math.max(0, audioElement.currentTime - 10);
        });

        btnForward10.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isResizingActive) {
                const maxTime = audioElement.duration || 0;
                audioElement.currentTime = Math.min(maxTime, audioElement.currentTime + 10);
            }
        });
        compactForwardButton.addEventListener('click', e => {
            e.stopPropagation();
            if (!isResizingActive) {
                const maxTime = audioElement.duration || 0;
                audioElement.currentTime = Math.min(maxTime, audioElement.currentTime + 10);
            }
        });

        let keyboardSeekInterval = null;
        let keyboardSeekDelay = null;
        let keyboardSeekDirection = 0;
        function stopKeyboardSeeking() {
            if (keyboardSeekInterval !== null) clearInterval(keyboardSeekInterval);
            if (keyboardSeekDelay !== null) clearTimeout(keyboardSeekDelay);
            keyboardSeekInterval = null;
            keyboardSeekDelay = null;
            keyboardSeekDirection = 0;
        }
        function seekFromKeyboard(direction) {
            if (isResizingActive || !audioElement.duration || !Number.isFinite(audioElement.duration)) return;
            audioElement.currentTime = Math.max(0, Math.min(audioElement.duration, audioElement.currentTime + direction * 10));
        }
        document.addEventListener('keydown', event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            const target = event.target;
            if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))) return;
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            event.preventDefault();
            const direction = event.key === 'ArrowLeft' ? -1 : 1;
            if (event.repeat || keyboardSeekDirection === direction) return;
            stopKeyboardSeeking();
            keyboardSeekDirection = direction;
            seekFromKeyboard(direction);
            keyboardSeekDelay = setTimeout(() => {
                keyboardSeekDelay = null;
                keyboardSeekInterval = setInterval(() => seekFromKeyboard(direction), 50);
            }, 500);
        });
        document.addEventListener('keyup', event => {
            if ((event.key === 'ArrowLeft' && keyboardSeekDirection < 0) || (event.key === 'ArrowRight' && keyboardSeekDirection > 0)) {
                stopKeyboardSeeking();
            }
        });
        window.addEventListener('blur', stopKeyboardSeeking);

        let seekbarAnimationFrame = null;
        function syncSeekbarProgress() {
            if (!audioElement.duration || !Number.isFinite(audioElement.duration)) return;
            updateSliderPosition(audioElement.currentTime / audioElement.duration * 100);
        }
        function animateSeekbarProgress() {
            seekbarAnimationFrame = null;
            if (!isSeeking) syncSeekbarProgress();
            if (!audioElement.paused && !audioElement.ended) {
                seekbarAnimationFrame = requestAnimationFrame(animateSeekbarProgress);
            }
        }
        function startSeekbarProgressAnimation() {
            if (seekbarAnimationFrame === null) seekbarAnimationFrame = requestAnimationFrame(animateSeekbarProgress);
        }
        function stopSeekbarProgressAnimation() {
            if (seekbarAnimationFrame !== null) cancelAnimationFrame(seekbarAnimationFrame);
            seekbarAnimationFrame = null;
            syncSeekbarProgress();
        }
        new ResizeObserver(() => {
            syncSeekbarProgress();
            renderLyricsCheckpointMarkers();
        }).observe(seekbarTrack);
        window.addEventListener('resize', syncSeekbarProgress);

        audioElement.addEventListener('play', () => {
            iconPlay.classList.add('hidden');
            iconPause.classList.remove('hidden');
            compactIconPlay.classList.add('hidden');
            compactIconPause.classList.remove('hidden');
            startSeekbarProgressAnimation();
        });

        audioElement.addEventListener('pause', () => {
            iconPause.classList.add('hidden');
            iconPlay.classList.remove('hidden');
            compactIconPause.classList.add('hidden');
            compactIconPlay.classList.remove('hidden');
            stopSeekbarProgressAnimation();
        });

        audioElement.addEventListener('ended', () => {
            iconPause.classList.add('hidden');
            iconPlay.classList.remove('hidden');
            compactIconPause.classList.add('hidden');
            compactIconPlay.classList.remove('hidden');
            updateSliderPosition(100);
            clearTimeout(endedResetTimer);
            endedResetTimer = setTimeout(() => {
                endedResetTimer = null;
                audioElement.currentTime = 0;
                updateSliderPosition(0);
                timeElapsedEl.textContent = formatTime(0);
                timeRemainingEl.textContent = formatTime(audioElement.duration || 0);
            }, 3000);
        });

        audioElement.addEventListener('loadedmetadata', () => {
            document.body.classList.add('audio-loaded');
            updateSliderPosition(0);
            timeElapsedEl.textContent = formatTime(0);
            timeRemainingEl.textContent = formatTime(audioElement.duration);
            clearMovementHistory();
            lyricsCheckpoints = [{ time: 0, row: -1, explicit: false }];
            selectedLyricsCheckpointTime = null;
            renderLyricsCheckpointMarkers();
            setActiveLyricsLine(0);
        });

        audioElement.addEventListener('timeupdate', () => {
            updateLyricsFromAudioTime();
            if (!isSeeking && audioElement.duration) {
                const currentTime = audioElement.currentTime;
                const duration = audioElement.duration;
                timeElapsedEl.textContent = formatTime(currentTime);
                timeRemainingEl.textContent = formatTime(Math.max(0, duration - currentTime));
            }
        });
        audioElement.addEventListener('seeking', () => {
            updateLyricsFromAudioTime();
            syncSeekbarProgress();
        });
        audioElement.addEventListener('seeked', () => {
            updateLyricsFromAudioTime();
            syncSeekbarProgress();
        });

        function updateSliderPosition(percentage) {
            const clamped = Math.max(0, Math.min(100, percentage));
            seekbarFill.style.width = `${clamped}%`;
            seekbarThumb.style.setProperty('--seekbar-thumb-x', `${seekbarTrack.clientWidth * clamped / 100}px`);
            compactSeekbarFill.style.width = `${clamped}%`;
            compactSeekbarThumb.style.left = `${clamped}%`;
            compactSeekbarTrack.setAttribute('aria-valuenow',String(Math.round(clamped)));
        }

        function handleSeek(e) {
            if (endedResetTimer !== null) {
                clearTimeout(endedResetTimer);
                endedResetTimer = null;
            }
            const rect = seekbarTrack.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const offsetX = clientX - rect.left;
            const percentage = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
            updateSliderPosition(percentage);

            if (audioElement.duration) {
                pendingSeekTime = (percentage / 100) * audioElement.duration;
                timeElapsedEl.textContent = formatTime(pendingSeekTime);
                timeRemainingEl.textContent = formatTime(Math.max(0, audioElement.duration - pendingSeekTime));
            }
        }
        function commitSeek() {
            if (pendingSeekTime !== null && audioElement.duration) audioElement.currentTime = pendingSeekTime;
            pendingSeekTime = null;
            isSeeking = false;
            syncSeekbarProgress();
        }

        function handleCompactSeek(e) {
            if (!audioElement.duration) return;
            if (endedResetTimer !== null) {
                clearTimeout(endedResetTimer);
                endedResetTimer = null;
            }
            const rect=compactSeekbarTrack.getBoundingClientRect();
            const clientX=e.touches?e.touches[0].clientX:e.clientX;
            const percentage=Math.max(0,Math.min(100,((clientX-rect.left)/rect.width)*100));
            updateSliderPosition(percentage);
            pendingSeekTime=percentage/100*audioElement.duration;
            timeElapsedEl.textContent=formatTime(pendingSeekTime);
            timeRemainingEl.textContent=formatTime(Math.max(0,audioElement.duration-pendingSeekTime));
        }
        compactSeekbarTrack.addEventListener('mousedown',e=>{
            if (isResizingActive || !audioElement.duration) return;
            if (e.target.closest('.compact-seekbar-checkpoint-marker')) return;
            e.preventDefault();
            isSeeking=true;
            handleCompactSeek(e);
            const onMouseMove=moveEvent=>{if(isSeeking)handleCompactSeek(moveEvent);};
            const onMouseUp=()=>{
                commitSeek();
                window.removeEventListener('mousemove',onMouseMove);
                window.removeEventListener('mouseup',onMouseUp);
            };
            window.addEventListener('mousemove',onMouseMove);
            window.addEventListener('mouseup',onMouseUp);
        });
        compactSeekbarTrack.addEventListener('touchstart',e=>{
            if (isResizingActive || !audioElement.duration) return;
            if (e.target.closest('.compact-seekbar-checkpoint-marker')) return;
            e.preventDefault();
            isSeeking=true;
            handleCompactSeek(e);
            const onTouchMove=moveEvent=>{if(isSeeking)handleCompactSeek(moveEvent);};
            const onTouchEnd=()=>{
                commitSeek();
                window.removeEventListener('touchmove',onTouchMove);
                window.removeEventListener('touchend',onTouchEnd);
                window.removeEventListener('touchcancel',onTouchEnd);
            };
            window.addEventListener('touchmove',onTouchMove,{passive:false});
            window.addEventListener('touchend',onTouchEnd);
            window.addEventListener('touchcancel',onTouchEnd);
        },{passive:false});
        compactSeekbarTrack.addEventListener('keydown',e=>{
            if (!audioElement.duration) return;
            const step=e.shiftKey?10:1;
            let nextTime=audioElement.currentTime;
            if (e.key==='ArrowUp'||e.key==='ArrowRight') nextTime+=step;
            else if (e.key==='ArrowDown'||e.key==='ArrowLeft') nextTime-=step;
            else if (e.key==='Home') nextTime=0;
            else if (e.key==='End') nextTime=audioElement.duration;
            else return;
            e.preventDefault();
            if (endedResetTimer !== null) {
                clearTimeout(endedResetTimer);
                endedResetTimer = null;
            }
            audioElement.currentTime=Math.max(0,Math.min(audioElement.duration,nextTime));
            syncSeekbarProgress();
        });

        seekbarCheckpoints.addEventListener('click', event => {
            const marker = event.target.closest('.seekbar-checkpoint-marker');
            if (!marker) return;
            event.preventDefault();
            event.stopPropagation();
            selectLyricsCheckpoint(Number(marker.dataset.time));
        });
        compactSeekbarCheckpoints.addEventListener('click',event=>{
            const marker=event.target.closest('.compact-seekbar-checkpoint-marker');
            if (!marker) return;
            event.preventDefault();
            event.stopPropagation();
            selectLyricsCheckpoint(Number(marker.dataset.time));
        });

        seekbarContainer.addEventListener('mousedown', (e) => {
            if (isResizingActive || isPillDragging) return;
            if (e.target.closest('.seekbar-checkpoint-marker')) return;
            if (e.target === timeElapsedEl || e.target === timeRemainingEl) return;
            isSeeking = true;
            handleSeek(e);

            const onMouseMove = (moveEvent) => { if (isSeeking) handleSeek(moveEvent); };
            const onMouseUp = () => {
                commitSeek();
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        seekbarContainer.addEventListener('touchstart', (e) => {
            if (isResizingActive || isPillDragging) return;
            if (e.target.closest('.seekbar-checkpoint-marker')) return;
            if (e.target === timeElapsedEl || e.target === timeRemainingEl) return;
            isSeeking = true;
            handleSeek(e);

            const onTouchMove = (moveEvent) => { if (isSeeking) handleSeek(moveEvent); };
            const onTouchEnd = () => {
                commitSeek();
                window.removeEventListener('touchmove', onTouchMove);
                window.removeEventListener('touchend', onTouchEnd);
                window.removeEventListener('touchcancel', onTouchEnd);
            };
            window.addEventListener('touchmove', onTouchMove, { passive: true });
            window.addEventListener('touchend', onTouchEnd);
            window.addEventListener('touchcancel', onTouchEnd);
        }, { passive: true });

        let isPillDragging = false;
        let currentPillOffset = 0;
        let compactReturnPillOffset = null;
        let dragStartClientX = 0;
        let dragStartOffset = 0;
        let dragPillTarget = null;
        let pillDragMoved = false;
        let pillDragClickResetTimer = null;

        function initPillDrag(e, target) {
            e.preventDefault();
            e.stopPropagation();

            isPillDragging = true;
            pillDragMoved = false;
            clearTimeout(pillDragClickResetTimer);
            dragPillTarget = target;
            dragStartClientX = e.touches ? e.touches[0].clientX : e.clientX;
            dragStartOffset = currentPillOffset;

            window.addEventListener('mousemove', handlePillDrag, { passive: false });
            window.addEventListener('mouseup', stopPillDrag);
            window.addEventListener('touchmove', handlePillDrag, { passive: false });
            window.addEventListener('touchend', stopPillDrag);
        }

        function handlePillDrag(e) {
            if (!isPillDragging) return;
            e.preventDefault();

            const currentX = e.touches ? e.touches[0].clientX : e.clientX;
            const deltaX = currentX - dragStartClientX;
            if (Math.abs(deltaX) > 4) pillDragMoved = true;

            let deltaOffset = dragPillTarget === 'left' ? deltaX : -deltaX;
            let proposedOffset = dragStartOffset + deltaOffset;

            updatePillOffset(proposedOffset);
        }

        function updatePillOffset(proposedOffset = currentPillOffset) {
            if (document.body.classList.contains('audio-mode-compact') ||
                document.body.classList.contains('audio-mode-invisible') ||
                !seekbarContainer.clientWidth) return;
            const minOffset = 0;
            // The custom property may be expressed in vw initially, so parseFloat alone
            // reads its numeric coefficient (for example, 8.5) instead of its pixel size.
            const audioHeight = cuadroDeAudio.getBoundingClientRect().height || (window.innerWidth * 0.085);
            const minTrackWidth = 1.1 * audioHeight;

            const containerWidth = seekbarContainer.clientWidth;
            const pillWidth = timeElapsedEl.offsetWidth;
            const initialGap = parseFloat(getComputedStyle(seekbarContainer).gap) || (audioHeight * 0.18);
            
            const initialTrackWidth = containerWidth - (2 * pillWidth) - (2 * initialGap);
            const maxOffset = Math.max(0, (initialTrackWidth - minTrackWidth) / 2);

            currentPillOffset = Math.max(minOffset, Math.min(proposedOffset, maxOffset));

            applyPillOffset();
        }

        function applyPillOffset() {
            timeElapsedEl.style.transform = `translateX(${currentPillOffset}px)`;
            timeRemainingEl.style.transform = `translateX(-${currentPillOffset}px)`;

            seekbarTrack.style.marginLeft = `${currentPillOffset}px`;
            seekbarTrack.style.marginRight = `${currentPillOffset}px`;
            syncSeekbarProgress();
        }

        function stopPillDrag() {
            if (!isPillDragging) return;
            isPillDragging = false;
            dragPillTarget = null;

            window.removeEventListener('mousemove', handlePillDrag);
            window.removeEventListener('mouseup', stopPillDrag);
            window.removeEventListener('touchmove', handlePillDrag);
            window.removeEventListener('touchend', stopPillDrag);
            if (pillDragMoved) pillDragClickResetTimer=setTimeout(()=>{pillDragMoved=false;},500);
        }

        timeElapsedEl.addEventListener('mousedown', (e) => initPillDrag(e, 'left'));
        timeElapsedEl.addEventListener('touchstart', (e) => initPillDrag(e, 'left'), { passive: false });

        timeRemainingEl.addEventListener('mousedown', (e) => initPillDrag(e, 'right'));
        timeRemainingEl.addEventListener('touchstart', (e) => initPillDrag(e, 'right'), { passive: false });

        /* --- MANEJO DE LÍNEAS GUÍA Y ESQUINAS SVG --- */
        function hideGuideLines(container) {
            const elTop = container.querySelector('.guide-line-top');
            const elBottom = container.querySelector('.guide-line-bottom');
            const elLeft = container.querySelector('.guide-line-left');
            const elRight = container.querySelector('.guide-line-right');
            const elTL = container.querySelector('.guide-corner-svg.top-left');
            const elTR = container.querySelector('.guide-corner-svg.top-right');
            const elBL = container.querySelector('.guide-corner-svg.bottom-left');
            const elBR = container.querySelector('.guide-corner-svg.bottom-right');

            if (elTop) elTop.style.display = 'none';
            if (elBottom) elBottom.style.display = 'none';
            if (elLeft) elLeft.style.display = 'none';
            if (elRight) elRight.style.display = 'none';
            if (elTL) elTL.style.display = 'none';
            if (elTR) elTR.style.display = 'none';
            if (elBL) elBL.style.display = 'none';
            if (elBR) elBR.style.display = 'none';
        }

        function updateGuideLines(e, container) {
            if (isDragging) {
                hideGuideLines(container);
                return;
            }

            const rect = container.getBoundingClientRect();
            if (!rect.width || !rect.height || getComputedStyle(container).display === 'none') {
                hideGuideLines(container);
                return;
            }
            const mouseX = e.clientX;
            const mouseY = e.clientY;

            const threshold = window.innerWidth * 0.03;
            // Calculo dinamico de radio de esquina
            const cornerRadius = parseFloat(getComputedStyle(container).borderTopLeftRadius) || 0;

            const topStraightLeft = rect.left + cornerRadius;
            const topStraightRight = rect.right - cornerRadius;

            const sideStraightTop = rect.top + cornerRadius;
            const sideStraightBottom = rect.bottom - cornerRadius;

            const distTop = Math.abs(mouseY - rect.top);
            const isNearTopStraight = (mouseX >= topStraightLeft && mouseX <= topStraightRight) && (distTop <= threshold);

            const distBottom = Math.abs(mouseY - rect.bottom);
            const isNearBottomStraight = (mouseX >= topStraightLeft && mouseX <= topStraightRight) && (distBottom <= threshold);

            const distLeft = Math.abs(mouseX - rect.left);
            const isNearLeftStraight = (mouseY >= sideStraightTop && mouseY <= sideStraightBottom) && (distLeft <= threshold);

            const distRight = Math.abs(mouseX - rect.right);
            const isNearRightStraight = (mouseY >= sideStraightTop && mouseY <= sideStraightBottom) && (distRight <= threshold);

            const handleTL = container.querySelector('.resize-handle-top-left');
            const handleTR = container.querySelector('.resize-handle-top-right');
            const handleBL = container.querySelector('.resize-handle-bottom-left');
            const handleBR = container.querySelector('.resize-handle-bottom-right');

            let isOverTL = false, isOverTR = false, isOverBL = false, isOverBR = false;

            if (handleTL) {
                const hlRect = handleTL.getBoundingClientRect();
                isOverTL = (mouseX >= hlRect.left && mouseX <= hlRect.right && mouseY >= hlRect.top && mouseY <= hlRect.bottom);
            }
            if (handleTR) {
                const hrRect = handleTR.getBoundingClientRect();
                isOverTR = (mouseX >= hrRect.left && mouseX <= hrRect.right && mouseY >= hrRect.top && mouseY <= hrRect.bottom);
            }
            if (handleBL) {
                const blRect = handleBL.getBoundingClientRect();
                isOverBL = (mouseX >= blRect.left && mouseX <= blRect.right && mouseY >= blRect.top && mouseY <= blRect.bottom);
            }
            if (handleBR) {
                const brRect = handleBR.getBoundingClientRect();
                isOverBR = (mouseX >= brRect.left && mouseX <= brRect.right && mouseY >= brRect.top && mouseY <= brRect.bottom);
            }

            const elTop = container.querySelector('.guide-line-top');
            const elBottom = container.querySelector('.guide-line-bottom');
            const elLeft = container.querySelector('.guide-line-left');
            const elRight = container.querySelector('.guide-line-right');
            const elTL = container.querySelector('.guide-corner-svg.top-left');
            const elTR = container.querySelector('.guide-corner-svg.top-right');
            const elBL = container.querySelector('.guide-corner-svg.bottom-left');
            const elBR = container.querySelector('.guide-corner-svg.bottom-right');

            const baseLengthPx = window.innerWidth * 0.08;
            const maxHorizontalLength = Math.max(0, rect.width - (2 * cornerRadius));
            const targetHorizLength = Math.min(baseLengthPx, maxHorizontalLength);

            const maxVerticalLength = Math.max(0, rect.height - (2 * cornerRadius));
            const sideGuideLength = container === cuadroDeAudio ? baseLengthPx / 2 : baseLengthPx;
            const targetVertLength = Math.min(sideGuideLength, maxVerticalLength);

            if (isNearTopStraight && targetHorizLength > 0) {
                elTop.style.width = `${targetHorizLength}px`;
                elTop.style.display = 'block';
            } else {
                if (elTop) elTop.style.display = 'none';
            }

            if (isNearBottomStraight && targetHorizLength > 0 && elBottom) {
                elBottom.style.width = `${targetHorizLength}px`;
                elBottom.style.display = 'block';
            } else {
                if (elBottom) elBottom.style.display = 'none';
            }

            if (isNearLeftStraight && targetVertLength > 0) {
                elLeft.style.height = `${targetVertLength}px`;
                elLeft.style.display = 'block';
            } else {
                if (elLeft) elLeft.style.display = 'none';
            }

            if (isNearRightStraight && targetVertLength > 0) {
                elRight.style.height = `${targetVertLength}px`;
                elRight.style.display = 'block';
            } else {
                if (elRight) elRight.style.display = 'none';
            }

            // Esquinas superior izquierda y derecha
            if (isOverTL && elTL) {
                elTL.style.width = `${cornerRadius}px`;
                elTL.style.height = `${cornerRadius}px`;
                const pathTL = elTL.querySelector('path');
                pathTL.setAttribute('d', `M 0,${cornerRadius} A ${cornerRadius},${cornerRadius} 0 0,1 ${cornerRadius},0`);
                elTL.style.display = 'block';
            } else if (elTL) {
                elTL.style.display = 'none';
            }

            if (isOverTR && elTR) {
                elTR.style.width = `${cornerRadius}px`;
                elTR.style.height = `${cornerRadius}px`;
                const pathTR = elTR.querySelector('path');
                pathTR.setAttribute('d', `M 0,0 A ${cornerRadius},${cornerRadius} 0 0,1 ${cornerRadius},${cornerRadius}`);
                elTR.style.display = 'block';
            } else if (elTR) {
                elTR.style.display = 'none';
            }

            // Esquinas inferior izquierda y derecha (exclusivas del cuadro de letras)
            if (isOverBL && elBL) {
                elBL.style.width = `${cornerRadius}px`;
                elBL.style.height = `${cornerRadius}px`;
                const pathBL = elBL.querySelector('path');
                pathBL.setAttribute('d', `M ${cornerRadius},${cornerRadius} A ${cornerRadius},${cornerRadius} 0 0,1 0,0`);
                elBL.style.display = 'block';
            } else if (elBL) {
                elBL.style.display = 'none';
            }

            if (isOverBR && elBR) {
                elBR.style.width = `${cornerRadius}px`;
                elBR.style.height = `${cornerRadius}px`;
                const pathBR = elBR.querySelector('path');
                pathBR.setAttribute('d', `M ${cornerRadius},0 A ${cornerRadius},${cornerRadius} 0 0,1 0,${cornerRadius}`);
                elBR.style.display = 'block';
            } else if (elBR) {
                elBR.style.display = 'none';
            }
        }

        const guideContainers = [cuadroDeAudio, btnUploadAudio, cuadroDeLetras, compactAudioFrame];
        let latestLyricsPointer = null;
        window.addEventListener('mousemove', (e) => {
            latestLyricsPointer = e;
            guideContainers.forEach(container => updateGuideLines(e, container));
            updateLyricsMoveHandle(e);
            updateLyricsEditorGuide(e);
        });

        /* --- LOGICA DE REDIMENSIONADO DE CUADROS --- */
        let isDragging = false;
        let currentTargetElement = null;

        const lyricsMoveHandle = document.getElementById('lyrics-move-handle');
        const lyricsReturnButton = document.getElementById('lyrics-return-button');
        function updateLyricsMoveHandle(e) {
            if (isDragging) return;
            if (document.body.classList.contains('intro-active') || document.body.classList.contains('intro-transitioning')) {
                lyricsMoveHandle.style.display = 'none';
                lyricsReturnButton.classList.add('hidden');
                return;
            }
            e = e || { clientX: -1e6, clientY: -1e6 };
            const rect = cuadroDeLetras.getBoundingClientRect();
            updateLyricsAlignmentControls();
            const outsideViewport = rect.right <= 0 || rect.left >= window.innerWidth ||
                rect.bottom <= 0 || rect.top >= window.innerHeight;
            if (outsideViewport) {
                lyricsMoveHandle.style.display = 'none';
                lyricsReturnButton.classList.remove('hidden');
                return;
            }
            lyricsReturnButton.classList.add('hidden');
            const threshold = window.innerWidth * 0.12;
            const margin = 42;
            const localX = e.clientX - rect.left;
            const localY = e.clientY - rect.top;
            const minX = -margin;
            const maxX = rect.width + margin;
            const minY = -margin;
            const maxY = rect.height + margin;
            const candidates = [
                { x: Math.max(minX, Math.min(maxX, localX)), y: minY },
                { x: Math.max(minX, Math.min(maxX, localX)), y: maxY },
                { x: minX, y: Math.max(minY, Math.min(maxY, localY)) },
                { x: maxX, y: Math.max(minY, Math.min(maxY, localY)) }
            ];
            candidates.forEach(point => {
                point.distance = Math.hypot(localX - point.x, localY - point.y);
            });
            const handleSize = 18;
            const isFree = (point) => {
                const x = rect.left + point.x;
                const y = rect.top + point.y;
                if (x < handleSize / 2 || y < handleSize / 2 || x > window.innerWidth - handleSize / 2 || y > window.innerHeight - handleSize / 2) return false;
                return [cuadroDeAudio, btnUploadAudio].every(control => {
                    if (getComputedStyle(control).display === 'none') return true;
                    const audio = control.getBoundingClientRect();
                    return x + handleSize / 2 <= audio.left || x - handleSize / 2 >= audio.right ||
                        y + handleSize / 2 <= audio.top || y - handleSize / 2 >= audio.bottom;
                });
            };
            const edgeSamples = [0.2, 0.5, 0.8].flatMap(t => [
                { x: rect.width * t, y: -margin },
                { x: rect.width * t, y: rect.height + margin },
                { x: -margin, y: rect.height * t },
                { x: rect.width + margin, y: rect.height * t }
            ]);
            const hasEdgeSpace = edgeSamples.some(isFree);
            const available = candidates.filter(point => point.distance <= threshold && isFree(point))
                .sort((a, b) => a.distance - b.distance);

            if (available.length) {
                lyricsMoveHandle.style.left = `${rect.left + available[0].x}px`;
                lyricsMoveHandle.style.top = `${rect.top + available[0].y}px`;
                lyricsMoveHandle.style.display = 'grid';
            } else if (!hasEdgeSpace) {
                lyricsMoveHandle.style.left = '50vw';
                lyricsMoveHandle.style.top = '50vh';
                lyricsMoveHandle.style.display = 'grid';
            } else {
                lyricsMoveHandle.style.display = 'none';
            }
        }

        updateLyricsMoveHandle();
        document.addEventListener('recK:intro-finished', () => updateLyricsMoveHandle(latestLyricsPointer));

        lyricsReturnButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = cuadroDeLetras.getBoundingClientRect();
            const targetLeft = (window.innerWidth - rect.width) / 2;
            const targetTop = (window.innerHeight - rect.height) / 2;
            updateLyricsAlignmentControls();
            lyricsReturnButton.classList.add('hidden');
            cuadroDeLetras.classList.add('lyrics-returning');
            const finishReturn = (event) => {
                if (event && !['top', 'left'].includes(event.propertyName)) return;
                cuadroDeLetras.removeEventListener('transitionend', finishReturn);
                clearTimeout(returnFallback);
                cuadroDeLetras.classList.remove('lyrics-returning');
                rememberLyricsScale();
                updateLyricsMoveHandle(latestLyricsPointer);
                updateLyricsEditorGuide(latestLyricsPointer || { clientX: -1e6, clientY: -1e6 });
            };
            const returnFallback = setTimeout(() => finishReturn(), 560);
            cuadroDeLetras.addEventListener('transitionend', finishReturn);
            document.documentElement.style.setProperty('--letras-left', `${targetLeft}px`);
            document.documentElement.style.setProperty('--letras-top', `${targetTop}px`);
        });

        let lyricsMoveStartX = 0;
        let lyricsMoveStartY = 0;
        let lyricsMoveStartRect = { top: 0, left: 0 };
        let lyricsMoveHandleOffset = { x: 0, y: 0 };
        const centerSnapHorizontal = document.getElementById('center-snap-horizontal');
        const centerSnapVertical = document.getElementById('center-snap-vertical');
        lyricsMoveHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            isResizingActive = true;
            document.body.style.setProperty('--active-cursor', 'grabbing');
            document.body.classList.add('resizing-active');
            lyricsMoveStartX = e.clientX;
            lyricsMoveStartY = e.clientY;
            const rect = cuadroDeLetras.getBoundingClientRect();
            const handleRect = lyricsMoveHandle.getBoundingClientRect();
            lyricsMoveStartRect = { top: rect.top, left: rect.left };
            lyricsMoveHandleOffset = {
                x: handleRect.left + handleRect.width / 2 - rect.left,
                y: handleRect.top + handleRect.height / 2 - rect.top
            };
            hideGuideLines(cuadroDeLetras);

            const move = (moveEvent) => {
                const rect = cuadroDeLetras.getBoundingClientRect();
                let top = lyricsMoveStartRect.top + moveEvent.clientY - lyricsMoveStartY;
                let left = lyricsMoveStartRect.left + moveEvent.clientX - lyricsMoveStartX;
                const snapDistance = 18;
                const centerX = (window.innerWidth - rect.width) / 2;
                const centerY = (window.innerHeight - rect.height) / 2;
                const snapX = Math.abs(left - centerX) <= snapDistance;
                const snapY = Math.abs(top - centerY) <= snapDistance;
                if (snapX) left = centerX;
                if (snapY) top = centerY;
                centerSnapVertical.classList.toggle('visible', snapX);
                centerSnapHorizontal.classList.toggle('visible', snapY);
                document.documentElement.style.setProperty('--letras-top', `${top}px`);
                document.documentElement.style.setProperty('--letras-left', `${left}px`);
                updateLyricsAlignmentControls();
                lyricsMoveHandle.style.left = `${left + lyricsMoveHandleOffset.x}px`;
                lyricsMoveHandle.style.top = `${top + lyricsMoveHandleOffset.y}px`;
            };
            const stop = () => {
                isDragging = false;
                centerSnapHorizontal.classList.remove('visible');
                centerSnapVertical.classList.remove('visible');
                rememberLyricsScale();
                document.body.classList.remove('resizing-active');
                document.body.style.removeProperty('--active-cursor');
                setTimeout(() => { isResizingActive = false; }, 50);
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', stop);
                updateLyricsMoveHandle(latestLyricsPointer);
            };
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', stop);
        });

        // Estado del redimensionado
        let resizeState = {
            top: false,
            bottom: false,
            left: false,
            right: false
        };

        let startY = 0;
        let startX = 0;
        let startRect = { top: 0, left: 0, width: 0, height: 0 };

        function getPointerY(e) { return e.touches ? e.touches[0].clientY : e.clientY; }
        function getPointerX(e) { return e.touches ? e.touches[0].clientX : e.clientX; }

        function initResize(e) {
            const target = e.target;
            const isTop = target.classList.contains('resize-handle-top');
            const isBottom = target.classList.contains('resize-handle-bottom');
            const isLeft = target.classList.contains('resize-handle-left');
            const isRight = target.classList.contains('resize-handle-right');

            const isTL = target.classList.contains('resize-handle-top-left');
            const isTR = target.classList.contains('resize-handle-top-right');
            const isBL = target.classList.contains('resize-handle-bottom-left');
            const isBR = target.classList.contains('resize-handle-bottom-right');

            if (!isTop && !isBottom && !isLeft && !isRight && !isTL && !isTR && !isBL && !isBR) return;

            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            isResizingActive = true;

            // Determinar que cuadro estamos estirando
            if (compactAudioFrame.contains(target)) {
                currentTargetElement = compactAudioFrame;
            } else if (cuadroDeLetras.contains(target)) {
                currentTargetElement = cuadroDeLetras;
            } else if (cuadroDeAudio.contains(target)) {
                currentTargetElement = cuadroDeAudio;
            } else {
                currentTargetElement = btnUploadAudio;
            }

            hideGuideLines(currentTargetElement);
            if (currentTargetElement === cuadroDeLetras) {
                lyricsMoveHandle.style.display = 'none';
            }

            const targetCursor = window.getComputedStyle(target).cursor;
            document.body.style.setProperty('--active-cursor', targetCursor);
            document.body.classList.add('resizing-active');

            resizeState.top = isTop || isTL || isTR;
            resizeState.bottom = isBottom || isBL || isBR;
            resizeState.left = isLeft || isTL || isBL;
            resizeState.right = isRight || isTR || isBR;

            startY = getPointerY(e);
            startX = getPointerX(e);

            const rect = currentTargetElement.getBoundingClientRect();
            startRect = {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            };

            window.addEventListener('mousemove', handleResize, { passive: false });
            window.addEventListener('mouseup', stopResize);
            window.addEventListener('touchmove', handleResize, { passive: false });
            window.addEventListener('touchend', stopResize);
        }

        function handleResize(e) {
            if (!isDragging) return;
            e.preventDefault();
            const currentY = getPointerY(e);
            const currentX = getPointerX(e);
            const deltaY = currentY - startY;
            const deltaX = currentX - startX;

            const bottomMarginPx = window.innerWidth * 0.01666;
            const calculatedMaxPx = window.innerWidth - (2 * bottomMarginPx);

            if (currentTargetElement === compactAudioFrame) {
                const minSideWidth = window.innerWidth * 0.085 * 2.7;
                const minWidth = Math.max(window.innerWidth * 0.15, minSideWidth * 2);
                const compactFrameStyle = getComputedStyle(compactAudioFrame);
                const minimumHeightProperty = compactAudioFrame.classList.contains('controls-below-seekbar')
                    ? '--compact-controls-below-minimum-frame-height'
                    : '--compact-minimum-frame-height';
                const compactFrameMinHeight = parseFloat(compactFrameStyle.getPropertyValue(minimumHeightProperty)) || 0;
                const minHeight = Math.max(window.innerWidth * 0.05, compactFrameMinHeight);
                const horizontalDelta = resizeState.left ? -deltaX : deltaX;
                const verticalDelta = resizeState.top ? -deltaY : deltaY;
                const newWidth = resizeState.left || resizeState.right
                    ? Math.max(minWidth, startRect.width + horizontalDelta * 2)
                    : startRect.width;
                const newHeight = resizeState.top || resizeState.bottom
                    ? Math.max(minHeight, startRect.height + verticalDelta * 2)
                    : startRect.height;
                document.documentElement.style.setProperty('--letras-width', `${newWidth}px`);
                if (resizeState.left || resizeState.right) fitCompactDividerToWidth(newWidth);
                const resizedMinHeight = parseFloat(getComputedStyle(compactAudioFrame).getPropertyValue(minimumHeightProperty)) || 0;
                const compactCollapseHeight = parseFloat(getComputedStyle(compactAudioFrame).getPropertyValue('--compact-empty-row-collapse-height')) || 0;
                document.documentElement.style.setProperty('--letras-height', `${Math.max(newHeight, resizedMinHeight) + compactCollapseHeight}px`);
                updateLyricsAlignmentControls();
                return;
            }

            // --- REDIMENSIONADO DEL CUADRO DE LETRAS (ASIMÉTRICO / 4 DIRECCIONES) ---
            if (currentTargetElement === cuadroDeLetras) {
                let newTop = startRect.top;
                let newLeft = startRect.left;
                let newWidth = startRect.width;
                let newHeight = startRect.height;

                const minWidth = window.innerWidth * 0.15;
                const minHeight = window.innerWidth * 0.05;

                if (e.shiftKey) {
                    const verticalDelta = resizeState.top ? -deltaY : deltaY;
                    const horizontalDelta = resizeState.left ? -deltaX : deltaX;

                    if (resizeState.top || resizeState.bottom) {
                        newHeight = Math.max(minHeight, startRect.height + (verticalDelta * 2));
                        newTop = startRect.top - ((newHeight - startRect.height) / 2);
                    }
                    if (resizeState.left || resizeState.right) {
                        newWidth = Math.max(minWidth, startRect.width + (horizontalDelta * 2));
                        newLeft = startRect.left - ((newWidth - startRect.width) / 2);
                    }
                } else {

                // Ajuste Superior
                if (resizeState.top) {
                    newHeight = Math.max(minHeight, startRect.height - deltaY);
                    newTop = startRect.top + (startRect.height - newHeight);
                }

                // Ajuste Inferior
                if (resizeState.bottom) {
                    newHeight = Math.max(minHeight, startRect.height + deltaY);
                }

                // Ajuste Izquierdo
                if (resizeState.left) {
                    newWidth = Math.max(minWidth, startRect.width - deltaX);
                    newLeft = startRect.left + (startRect.width - newWidth);
                }

                // Ajuste Derecho
                if (resizeState.right) {
                    newWidth = Math.max(minWidth, startRect.width + deltaX);
                }
                }

                document.documentElement.style.setProperty('--letras-top', `${newTop}px`);
                document.documentElement.style.setProperty('--letras-left', `${newLeft}px`);
                document.documentElement.style.setProperty('--letras-width', `${newWidth}px`);
                document.documentElement.style.setProperty('--letras-height', `${newHeight}px`);
                updateLyricsLinePosition();
                updateLyricsAlignmentControls();
                return;
            }

            // --- REDIMENSIONADO DEL CUADRO DE AUDIO / UPLOAD (MANTENIENDO COMPORTAMIENTO ORIGINAL) ---
            let currentHeightPx = startRect.height;

            if (resizeState.top) {
                const diffY = startY - currentY;
                const newHeightPx = startRect.height + diffY;

                const minPx = window.innerWidth * 0.03;
                const maxPx = calculatedMaxPx / 4.5;
                currentHeightPx = Math.max(minPx, Math.min(newHeightPx, maxPx));

                document.documentElement.style.setProperty('--audio-height', `${currentHeightPx}px`);
            }

            if (resizeState.left || resizeState.right) {
                const deltaWidth = resizeState.left ? -deltaX * 2 : deltaX * 2;
                const newWidthPx = startRect.width + deltaWidth;

                const calculatedMinPx = currentHeightPx * 4.5;
                const clampedWidthPx = Math.max(calculatedMinPx, Math.min(newWidthPx, calculatedMaxPx));

                document.documentElement.style.setProperty('--audio-width', `${clampedWidthPx}px`);
            }

            updatePillOffset();
        }

        function stopResize() {
            if (!isDragging) return;
            isDragging = false;
            const resizedTarget = currentTargetElement;
            currentTargetElement = null;
            
            document.body.classList.remove('resizing-active');
            document.body.style.removeProperty('--active-cursor');

            setTimeout(() => { isResizingActive = false; }, 50);

            window.removeEventListener('mousemove', handleResize);
            window.removeEventListener('mouseup', stopResize);
            window.removeEventListener('touchmove', handleResize);
            window.removeEventListener('touchend', stopResize);

            if (resizedTarget === cuadroDeAudio || resizedTarget === btnUploadAudio) {
                if (document.body.classList.contains('audio-mode-full')) {
                    audioViewportScale.height = resizedTarget.getBoundingClientRect().height;
                    audioViewportScale.viewportWidth = window.innerWidth;
                } else {
                    rememberAudioScale();
                }
            } else if (resizedTarget === cuadroDeLetras) {
                rememberLyricsScale();
            } else if (resizedTarget === compactAudioFrame) {
                const compactRect = compactAudioFrame.getBoundingClientRect();
                lyricsViewportScale.vw = window.innerWidth;
                lyricsViewportScale.vh = window.innerHeight;
                lyricsViewportScale.width = compactRect.width;
                const compactCollapseHeight = parseFloat(getComputedStyle(compactAudioFrame).getPropertyValue('--compact-empty-row-collapse-height')) || 0;
                lyricsViewportScale.height = compactRect.height + compactCollapseHeight;
                updateLyricsAlignmentControls();
            }

            updateAllMarquees();
            if (resizedTarget === cuadroDeAudio || resizedTarget === btnUploadAudio) updatePillOffset();
        }

        [btnUploadAudio, cuadroDeAudio, cuadroDeLetras, compactAudioFrame].forEach(el => {
            el.addEventListener('mousedown', initResize);
            el.addEventListener('touchstart', initResize, { passive: false });
        });

        window.addEventListener('resize', () => {
            scaleAudioWithViewport();
            scaleLyricsWithViewport();
                    applyLyricsShadowOrGlow();
            applyAudioShadowOrGlow();
            updateLyricsLinePosition();
            updateLyricsAlignmentControls();
            updateLyricsMoveHandle(latestLyricsPointer);
            updateAllMarquees();
            updatePillOffset();
        });

        function addSettingsOptionPill(toggle, options, getValue, onSelect) {
            const pill=document.createElement('div');
            pill.className='settings-option-pill';
            pill.setAttribute('role','group');
            pill.setAttribute('aria-label',toggle.getAttribute('aria-label')||'Seleccionar opcion');
            const indicator=document.createElement('span');
            indicator.className='settings-option-pill-indicator';
            indicator.setAttribute('aria-hidden','true');
            pill.append(indicator);
            const choices=options.map(({label,value})=>{
                const choice=document.createElement('button');
                choice.type='button';
                choice.textContent=label;
                choice.setAttribute('aria-pressed','false');
                choice.addEventListener('click',event=>{
                    event.stopPropagation();
                    if (onSelect) onSelect(value);
                    else for(let i=0;i<options.length&&getValue()!==value;i++) toggle.click();
                    sync();
                });
                pill.append(choice);
                return {choice,value};
            });
            function sync() {
                const selected=getValue();
                choices.forEach(({choice,value})=>choice.setAttribute('aria-pressed',String(value===selected)));
                const selectedChoice=choices.find(({value})=>value===selected)?.choice;
                if (!selectedChoice) { indicator.style.opacity='0'; return; }
                indicator.style.width=`${selectedChoice.offsetWidth}px`;
                indicator.style.height=`${selectedChoice.offsetHeight}px`;
                indicator.style.top=`${selectedChoice.offsetTop}px`;
                indicator.style.transform=`translateX(${selectedChoice.offsetLeft}px)`;
                indicator.style.opacity='1';
            }
            toggle.classList.add('settings-pill-source');
            toggle.before(pill);
            new MutationObserver(sync).observe(toggle,{attributes:true,childList:true,characterData:true,subtree:true});
            new ResizeObserver(sync).observe(pill);
            sync();
            return pill;
        }
        const backgroundModePill=addSettingsOptionPill(backgroundModeToggle,[{label:'Color',value:'color'},{label:'Imagen',value:'image'},{label:'Video',value:'video'}],()=>currentBackgroundMode,value=>{
            setBackgroundMode(value);
        });
        const backgroundModeControls=document.createElement('div');
        backgroundModeControls.className='background-mode-controls';
        backgroundModePill.before(backgroundModeControls);
        backgroundModeControls.append(backgroundModePill,settingsSyncButtons.find(button=>button.dataset.syncColors==='background'));
        addSettingsOptionPill(progressTrackModeToggle,[{label:'Oscuro',value:'Oscuro'},{label:'Claro',value:'Claro'}],()=>progressTrackModeToggle.textContent.trim());
        addSettingsOptionPill(counterThumbToggle,[{label:'Visible',value:'Visible'},{label:'Oculto',value:'Oculto'}],()=>counterThumbToggle.textContent.trim());
        addSettingsOptionPill(playButtonCircleToggle,[{label:'Simple',value:'Oculto'},{label:'Completo',value:'Visible'}],()=>playButtonCircleToggle.textContent.trim()==='Visible'?'Visible':'Oculto');
        addSettingsOptionPill(lyricsShadowLightToggle,[{label:'Desactivado',value:'Desactivado'},{label:'Sombra',value:'Sombra'},{label:'Luz',value:'Luz'}],()=>lyricsShadowLightToggle.textContent.trim());
        addSettingsOptionPill(audioShadowLightToggle,[{label:'Sombra',value:'Sombra'},{label:'Luz',value:'Luz'},{label:'Desactivado',value:'Desactivado'}],()=>audioShadowLightToggle.textContent.trim());
        addSettingsOptionPill(playButtonShadowLightToggle,[{label:'Desactivado',value:'Desactivado'},{label:'Sombra',value:'Sombra'},{label:'Luz',value:'Luz'}],()=>playButtonShadowLightToggle.textContent.trim());
        addSettingsOptionPill(audioLayoutMode,[{label:'Invisible',value:'Invisible'},{label:'Flotante',value:'Flotante'},{label:'Completo',value:'Completo'},{label:'Compacto',value:'Compacto'}],()=>audioLayoutMode.textContent.trim());
