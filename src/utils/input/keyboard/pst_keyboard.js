export class Pst_Keyboard
{
    constructor()
    {
        this._keys = {};
        this._justPressed = {};
    }

    init()
    {
        window.addEventListener('keydown', (e) =>
        {
            e.preventDefault();
            if (!this._keys[e.code])
            {
                this._justPressed[e.code] = true;
            }
            this._keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) =>
        {
            e.preventDefault();
            this._keys[e.code] = false;
        });

        window.addEventListener('blur', (e) =>
        {
            e.preventDefault();
            this._keys = {};
        });
    }

    isDown(code)
    {
        return !!this._keys[code];
    }

    wasPressed(code)
    {
        return !!this._justPressed[code];
    }

    endFrame()
    {
        this._justPressed = {};
    }
}