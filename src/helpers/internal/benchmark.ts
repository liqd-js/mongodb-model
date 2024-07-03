const formatter = new Intl.DateTimeFormat( 'en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', fractionalSecondDigits: 3, hour12: false });

export class Benchmark
{
    public start = new Date();
    public last = Date.now();

    public elapsed()
    {
        return Date.now() - this.start.getTime();
    }

    public step()
    {
        const now = Date.now(), step = now - this.last;

        this.last = now;

        return step;
    }

    public get startTime()
    {
        return formatter.format( this.start );
    }

    public get time()
    {
        return formatter.format( new Date() );
    }
}
