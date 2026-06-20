export class Pst_Keyboard
{
    constructor()
    {
        this.keys = {};
        this.justPressed = {};
    }

    init()
    {
        window.addEventListener('keydown', (e) =>
        {
            e.preventDefault();
            if (!this.keys[e.code])
            {
                this.justPressed[e.code] = true;
            }
            this.keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) =>
        {
            e.preventDefault();
            this.keys[e.code] = false;
        });

        window.addEventListener('blur', (e) =>
        {
            e.preventDefault();
            this.keys = {};
        });
    }

    isDown(code)
    {
        return !!this.keys[code];
    }

    wasPressed(code)
    {
        return !!this.justPressed[code];
    }

    endFrame()
    {
        this.justPressed = {};
    }
}